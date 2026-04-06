import base64
from datetime import datetime
from fpdf import FPDF


def run(title, body, author=""):
    """Generate a formatted PDF report."""
    if not title or not title.strip():
        return {"result": ""}
    if not body or not body.strip():
        body = "(No content provided.)"

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # Title
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 12, title, new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(4)

    # Author and date line
    pdf.set_font("Helvetica", "", 10)
    meta_parts = []
    if author:
        meta_parts.append(author)
    meta_parts.append(datetime.now().strftime("%B %d, %Y"))
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 6, " | ".join(meta_parts), new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(8)

    # Divider
    pdf.set_draw_color(200, 200, 200)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(8)

    # Body paragraphs
    pdf.set_font("Helvetica", "", 11)
    paragraphs = body.strip().split("\n\n")
    for i, para in enumerate(paragraphs):
        # Check if paragraph looks like a heading (starts with # or is all caps short line)
        stripped = para.strip()
        if stripped.startswith("# "):
            pdf.set_font("Helvetica", "B", 14)
            pdf.cell(0, 8, stripped[2:], new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)
            pdf.set_font("Helvetica", "", 11)
        elif stripped.startswith("## "):
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 7, stripped[3:], new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)
            pdf.set_font("Helvetica", "", 11)
        else:
            clean = stripped.replace("\n", " ")
            pdf.multi_cell(0, 6, clean)
            pdf.ln(4)

    # Output as base64-encoded PDF
    pdf_bytes = pdf.output()
    encoded = base64.b64encode(pdf_bytes).decode("utf-8")

    return {"result": encoded}
