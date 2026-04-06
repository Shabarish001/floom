import html as html_lib


def run(subject, body, cta_text="", cta_url="", brand_color="#2563eb"):
    """Generate a responsive HTML email template."""
    safe_subject = html_lib.escape(subject)
    safe_color = html_lib.escape(brand_color) if brand_color else "#2563eb"

    # Build body paragraphs
    paragraphs = body.strip().split("\n\n")
    body_html = ""
    for para in paragraphs:
        safe_para = html_lib.escape(para.strip()).replace("\n", "<br>")
        body_html += f'<p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">{safe_para}</p>\n'

    # CTA button
    cta_html = ""
    if cta_text and cta_url:
        safe_cta_text = html_lib.escape(cta_text)
        safe_cta_url = html_lib.escape(cta_url)
        cta_html = f'''
            <table role="presentation" style="margin:24px auto;">
              <tr>
                <td style="border-radius:6px;background:{safe_color};">
                  <a href="{safe_cta_url}" target="_blank" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">{safe_cta_text}</a>
                </td>
              </tr>
            </table>'''

    email_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>{safe_subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:{safe_color};padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">{safe_subject}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              {body_html}
              {cta_html}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;text-align:center;">
                You received this email because you are subscribed. <a href="#" style="color:{safe_color};text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>'''

    return {"result": email_html}
