import json
import requests
from bs4 import BeautifulSoup


def run(url):
    """Extract structured data from a web page."""
    response = requests.get(url, timeout=15, headers={
        "User-Agent": "Mozilla/5.0 (compatible; Floom/1.0)"
    })
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    title = soup.title.string.strip() if soup.title and soup.title.string else ""

    meta_description = ""
    meta_tag = soup.find("meta", attrs={"name": "description"})
    if meta_tag and meta_tag.get("content"):
        meta_description = meta_tag["content"].strip()

    headings = []
    for level in range(1, 4):
        for h in soup.find_all(f"h{level}"):
            text = h.get_text(strip=True)
            if text:
                headings.append({"level": level, "text": text})

    links = []
    for a in soup.find_all("a", href=True)[:50]:
        text = a.get_text(strip=True)
        href = a["href"]
        if href.startswith("http"):
            links.append({"text": text or href, "href": href})

    images = []
    for img in soup.find_all("img", src=True)[:20]:
        images.append({
            "src": img["src"],
            "alt": img.get("alt", ""),
        })

    data = {
        "title": title,
        "meta_description": meta_description,
        "headings": headings[:30],
        "links": links,
        "images": images,
    }

    return {"result": json.dumps(data, indent=2)}
