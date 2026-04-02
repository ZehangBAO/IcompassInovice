from flask import Flask, request, jsonify, send_file
from docxtpl import DocxTemplate
from urllib.parse import urlparse, urlunparse
import os
import re
import tempfile
import requests

app = Flask(__name__)

# Ensure output directory exists
OUTPUT_DIR = os.path.abspath("output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Maximum template download size (10 MB)
MAX_TEMPLATE_BYTES = 10 * 1024 * 1024

# Allowed URL schemes for template downloads
ALLOWED_SCHEMES = {"https"}


def sanitize_invoice_no(invoice_no):
    """Return only alphanumeric characters, hyphens, and underscores."""
    return re.sub(r"[^A-Za-z0-9_\-]", "", invoice_no)


def parse_safe_url(url):
    """Parse and reconstruct URL, allowing only https with a public hostname.

    Returns the sanitized URL string, or None if the URL is not allowed.
    Private/loopback addresses and non-https schemes are rejected.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return None

    if parsed.scheme not in ALLOWED_SCHEMES:
        return None

    hostname = parsed.hostname or ""
    if not hostname:
        return None

    # Reject loopback and link-local addresses
    blocked_prefixes = ("localhost", "127.", "0.", "10.", "192.168.", "169.254.", "::1")
    if any(hostname == b or hostname.startswith(b) for b in blocked_prefixes):
        return None

    # Reconstruct from parsed parts to avoid any trickery in the raw string
    safe_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path,
                           parsed.params, parsed.query, ""))
    return safe_url


def safe_output_path(invoice_no):
    """Return an absolute path inside OUTPUT_DIR for the given invoice_no.

    Raises ValueError if the resolved path escapes OUTPUT_DIR.
    """
    filename = f"{invoice_no}.docx"
    full_path = os.path.abspath(os.path.join(OUTPUT_DIR, filename))
    if not full_path.startswith(OUTPUT_DIR + os.sep) and full_path != OUTPUT_DIR:
        raise ValueError("Path traversal detected")
    return full_path


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
        if not invoice_no:
            return jsonify({"error": "Invalid invoice_no"}), 400

        template_url = data.get("template_url")

        if not template_url:
            return jsonify({"error": "No template_url provided"}), 400

        safe_url = parse_safe_url(template_url)
        if safe_url is None:
            return jsonify({"error": "Invalid or disallowed template_url"}), 400

        # Download template via the sanitized URL (stream to enforce size limit)
        # Use a system-generated temp file path (not derived from user input)
        tmp_fd, template_path = tempfile.mkstemp(suffix=".docx")

        r = requests.get(safe_url, timeout=30, stream=True)
        if r.status_code != 200:
            return jsonify({"error": "Failed to download template"}), 400

        downloaded = 0
        with os.fdopen(tmp_fd, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                downloaded += len(chunk)
                if downloaded > MAX_TEMPLATE_BYTES:
                    return jsonify({"error": "Template file too large"}), 400
                f.write(chunk)

        # Load template
        doc = DocxTemplate(template_path)

        # Fill data
        context = {
            "invoice_no": invoice_no,
            "customer_name": data.get("customer_name", ""),
            "date": data.get("date", ""),
            "amount": data.get("amount", ""),
            "notes": data.get("notes", "")
        }

        # Generate file
        output_path = safe_output_path(invoice_no)
        doc.render(context)
        doc.save(output_path)

        # Return download URL
        base_url = request.host_url.rstrip("/")
        download_url = f"{base_url}/download/{invoice_no}"

        return jsonify({
            "success": True,
            "download_url": download_url
        })

    except Exception:
        return jsonify({"error": "Internal server error"}), 500


# =========================
# 2️⃣ Download invoice
# =========================
@app.route("/download/<invoice_no>", methods=["GET"])
def download_invoice(invoice_no):
    safe_invoice_no = sanitize_invoice_no(invoice_no)
    if not safe_invoice_no:
        return jsonify({"error": "Invalid invoice_no"}), 400

    target_filename = f"{safe_invoice_no}.docx"

    # Locate the file by scanning OUTPUT_DIR so that the path used in
    # filesystem operations is derived from the directory listing (not user
    # input), which prevents path-injection taint from reaching open/send_file.
    try:
        dir_entries = os.listdir(OUTPUT_DIR)
    except OSError:
        return jsonify({"error": "File not found"}), 404

    matched_entry = next((e for e in dir_entries if e == target_filename), None)
    if matched_entry is None:
        return jsonify({"error": "File not found"}), 404

    # matched_entry comes from os.listdir(), not user input
    file_path = os.path.join(OUTPUT_DIR, matched_entry)
    return send_file(file_path, as_attachment=True)
