from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(page_title="7to6 무캐리어 여행 경로", page_icon="🧳", layout="wide")

html_path = Path(__file__).with_name("app.html")
html_content = html_path.read_text(encoding="utf-8")

components.html(html_content, height=900, scrolling=True)
