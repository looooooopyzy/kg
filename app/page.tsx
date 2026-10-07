import Script from "next/script";
import bodyHtml from "../site/body.html?raw";

export default function Home() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <Script src="/app.js" strategy="afterInteractive" />
      <Script src="/draft.js" strategy="afterInteractive" />
    </>
  );
}
