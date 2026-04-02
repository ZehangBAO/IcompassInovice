import ipaddress
import logging
import os
import re
import socket
import tempfile
from urllib.parse import urlparse

import requests
from docxtpl import DocxTemplate
from flask import Flask, jsonify, request, send_file

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Ensure output directory exists
os.makedirs("output", exist_ok=True)

# Maximum template download size: 20 MB
MAX_TEMPLATE_SIZE = 20 * 1024 * 1024

# Allowed URL schemes for template downloads
ALLOWED_SCHEMES = {"http", "https"}


def sanitize_invoice_no(invoice_no: str) -> str:
    """Return a filesystem-safe invoice number (alphanumeric, hyphens, underscores only)."""
    return re.sub(r"[^A-Za-z0-9_\-]", "_", invoice_no)


def _is_private_ip(hostname: str) -> bool:
    """Return True if the hostname resolves to a private/loopback/link-local address."""
    try:
        addr = ipaddress.ip_address(socket.gethostbyname(hostname))
        return addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved
    except Exception:
        return True  # Treat unresolvable hosts as unsafe


def validate_template_url(url: str) -> bool:
    """Validate URL scheme and ensure it does not point to an internal/private host."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ALLOWED_SCHEMES or not parsed.netloc:
            return False
        hostname = parsed.hostname
        if not hostname:
            return False
        return not _is_private_ip(hostname)
    except Exception:
        return False


@app.route("/")
def home():
    return "Invoice API running 🚀"


# =========================
# 1️⃣ Generate invoice
# =========================
@app.route("/generate-invoice", methods=["POST"])
def generate_invoice():
    try:
        data = request.json or {}

        raw_invoice_no = data.get("invoice_no", "INV-000")
        invoice_no = sanitize_invoice_no(raw_invoice_no)
        template_url = data.get("template_url")

        if not template_url:
            return jsonify({"error": "No template_url provided"}), 400

        if not validate_template_url(template_url):
            return jsonify({"error": "Invalid template_url"}), 400

        # Download template with size limit
        r = requests.get(template_url, timeout=30, stream=True)
        if r.status_code != 200:
            return jsonify({"error": "Failed to download template"}), 400

        chunks = []
        downloaded = 0
        for chunk in r.iter_content(chunk_size=8192):
            downloaded += len(chunk)
            if downloaded > MAX_TEMPLATE_SIZE:
                return jsonify({"error": "Template file too large"}), 400
            chunks.append(chunk)
        template_content = b"".join(chunks)

        # Write to a temporary file (auto-cleaned up after the block)
        with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
            tmp.write(template_content)
            template_path = tmp.name

        try:
            # Load template and render
            doc = DocxTemplate(template_path)

            context = {
                "invoice_no": invoice_no,
                "customer_name": data.get("customer_name", ""),
                "date": data.get("date", ""),
                "amount": data.get("amount", ""),
                "notes": data.get("notes", "")
            }

            output_dir = os.path.realpath("output")
            output_path = os.path.realpath(os.path.join(output_dir, f"{invoice_no}.docx"))
            if not output_path.startswith(output_dir + os.sep):
                return jsonify({"error": "Invalid invoice number"}), 400
            doc.render(context)
            doc.save(output_path)
        finally:
            os.unlink(template_path)

        # Return download URL
        base_url = request.host_url.rstrip("/")
        download_url = f"{base_url}/download/{invoice_no}"

        return jsonify({
            "success": True,
            "download_url": download_url
        })

    except Exception as e:
        app.logger.exception("Error generating invoice")
        return jsonify({"error": "Internal server error"}), 500


# =========================
# 2️⃣ Download invoice
# =========================
@app.route("/download/<invoice_no>", methods=["GET"])
def download_invoice(invoice_no):
    invoice_no = sanitize_invoice_no(invoice_no)
    output_dir = os.path.realpath("output")
    file_path = os.path.realpath(os.path.join(output_dir, f"{invoice_no}.docx"))

    # Ensure the resolved path is inside the output directory
    if not file_path.startswith(output_dir + os.sep):
        return jsonify({"error": "Invalid invoice number"}), 400

    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    return send_file(
        file_path,
        as_attachment=True,
        download_name=f"{invoice_no}.docx",
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
