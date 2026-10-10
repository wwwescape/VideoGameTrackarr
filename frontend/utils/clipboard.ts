/**
 * Copies text to the clipboard. navigator.clipboard only exists in secure contexts
 * (HTTPS or localhost), so a self-hosted instance opened over plain HTTP on a LAN address
 * falls back to the legacy execCommand("copy") on a temporary textarea.
 */
export async function copyText(text: string): Promise<void> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    if (!document.execCommand("copy")) {
      throw new Error("execCommand copy was rejected");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}
