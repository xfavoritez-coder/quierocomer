import { Metadata } from "next";
import { readFileSync } from "fs";
import { join } from "path";

export const metadata: Metadata = {
  title: "Subir mi carta · QuieroComer",
  description: "Sube tu carta física, PDF o link QR y nuestra IA la transforma en una Carta Viva.",
};

export default function SubirCartaPage() {
  const html = readFileSync(join(process.cwd(), "public", "subircarta.html"), "utf-8");
  // Extract only the body content and styles
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/i);

  return (
    <>
      {styleMatch && <style dangerouslySetInnerHTML={{ __html: styleMatch[1] }} />}
      <div dangerouslySetInnerHTML={{ __html: bodyMatch?.[1]?.replace(/<script[\s\S]*<\/script>/gi, "") || "" }} />
      {scriptMatch && <script dangerouslySetInnerHTML={{ __html: scriptMatch[1] }} />}
    </>
  );
}
