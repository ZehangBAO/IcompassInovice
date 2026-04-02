from pathlib import Path
import re
import tempfile

import requests
from docxtpl import DocxTemplate
from flask import Flask, jsonify, request, send_file


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "output"
TEMPLATES_DIR = BASE_DIR / "templates"
OUTPUT_DIR.mkdir(exist_ok=True)
TEMPLATES_DIR.mkdir(exist_ok=True)

app = Flask(__name__)


def sanitize_invoice_no(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", (value or "").strip())
    return cleaned or "INV-000"


def build_context(payload: dict, invoice_no: str) -> dict:
    # Pass through incoming fields except template selectors so custom
    # templates can use senderName, items, or any other keys directly.
    context = {
        key: value
        for key, value in payload.items()
        if key not in {"template_name", "template_url"} and value is not None
    }
    context.setdefault("invoice_no", invoice_no)
    return context


def download_template(template_url: str, invoice_no: str) -> Path:
    response = requests.get(template_url, timeout=30)
    response.raise_for_status()

    template_path = Path(tempfile.gettempdir()) / f"{invoice_no}_template.docx"
    template_path.write_bytes(response.content)
    return template_path


def resolve_template(data: dict, invoice_no: str) -> tuple[Path, bool]:
    template_url = data.get("template_url")
    if template_url:
        return download_template(template_url, invoice_no), True

    template_name = str(data.get("template_name") or "finance_invoice.docx").strip()
    safe_template_name = Path(template_name).name
    template_path = TEMPLATES_DIR / safe_template_name

    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {safe_template_name}")

    return template_path, False


@app.route("/")
def home():
    return "Invoice API running"


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/templates")
def list_templates():
    templates = sorted(path.name for path in TEMPLATES_DIR.glob("*.docx"))
    return jsonify({"templates": templates})


@app.route("/generate-invoice", methods=["POST"])
def generate_invoice():
    template_path = None
    cleanup_template = False

    try:
        data = request.get_json(silent=True) or {}

        invoice_no = str(data.get("invoice_no") or "INV-000")
        safe_invoice_no = sanitize_invoice_no(invoice_no)
        template_path, cleanup_template = resolve_template(data, safe_invoice_no)

        doc = DocxTemplate(str(template_path))
        context = build_context(data, invoice_no)

        output_path = OUTPUT_DIR / f"{safe_invoice_no}.docx"
        doc.render(context)
        doc.save(str(output_path))

        base_url = request.host_url.rstrip("/")
        download_url = f"{base_url}/download/{safe_invoice_no}"

        return jsonify(
            {
                "success": True,
                "invoice_no": invoice_no,
                "template_name": data.get("template_name") or template_path.name,
                "download_url": download_url,
            }
        )

    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 400
    except requests.RequestException as exc:
        return jsonify({"error": f"Failed to download template: {exc}"}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
    finally:
        if cleanup_template and template_path and template_path.exists():
            template_path.unlink(missing_ok=True)


@app.route("/download/<invoice_no>", methods=["GET"])
def download_invoice(invoice_no):
    safe_invoice_no = sanitize_invoice_no(invoice_no)
    file_path = OUTPUT_DIR / f"{safe_invoice_no}.docx"

    if not file_path.exists():
        return jsonify({"error": "File not found"}), 404

    return send_file(
        str(file_path),
        as_attachment=True,
        download_name=f"{safe_invoice_no}.docx",
    )
