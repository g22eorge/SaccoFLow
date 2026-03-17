const publicLightThemeScript = `
(() => {
  try {
    const lightTokens = {
      "--background": "#f2f5fb",
      "--foreground": "#172033",
      "--surface": "#ffffff",
      "--surface-soft": "#f5f8ff",
      "--border": "#d8dfed",
      "--accent": "#f0c619",
      "--accent-strong": "#d8b110",
      "--ring": "#f0c61966",
      "--muted": "#4f5d78",
      "--muted-soft": "#70819c",
      "--cta-text": "#1a2334",
    };
    for (const token in lightTokens) {
      document.documentElement.style.setProperty(token, lightTokens[token]);
    }
    document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.colorScheme = "light";
  } catch {}
})();
`;

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: publicLightThemeScript }} />
      {children}
    </>
  );
}
