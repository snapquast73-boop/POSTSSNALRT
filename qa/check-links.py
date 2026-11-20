#!/usr/bin/env python3
"""Check local links in the static HTML and README before a Pages release."""
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        self.links.extend((self.getpos()[0], value) for name, value in attrs
                          if name in {'href', 'src'} and value)


def main():
    errors = []
    for page in sorted([*ROOT.glob('*.html'), *ROOT.glob('*.md'), *ROOT.glob('docs/**/*.md'), *ROOT.glob('assets/audio/*.md')]):
        text = page.read_text(encoding='utf-8')
        if page.suffix == '.html':
            parser = Links()
            parser.feed(text)
            links = parser.links
        else:
            links = [(i, match[1]) for i, line in enumerate(text.splitlines(), 1)
                     for match in re.finditer(r'\]\(([^)]+)\)', line)]
        for line, url in links:
            target = urlsplit(url)
            if target.scheme or target.netloc or not target.path:
                continue
            path = unquote(target.path)
            if path.startswith('/POSTSSNALRT/'):
                destination = ROOT / path.removeprefix('/POSTSSNALRT/')
            elif path.startswith('/'):
                errors.append(f'{page.name}:{line}: outside Pages project: {url}')
                continue
            else:
                destination = page.parent / path
            if not destination.resolve().is_relative_to(ROOT) or not (
                destination.is_file() or (destination / 'index.html').is_file()
            ):
                errors.append(f'{page.name}:{line}: unresolved local link: {url}')
    for error in errors:
        print(error)
    print(f'{len(errors)} unresolved local references')
    return bool(errors)


if __name__ == '__main__':
    raise SystemExit(main())
