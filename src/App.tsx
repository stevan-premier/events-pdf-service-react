import { useRef, useState } from "react";
import { generateDailyEvents } from "./services/events";
import type { ListType } from "./services/events";
import "./App.css";
import { loadPdfTranslations } from "./services/translations";

type DownloadInfo = { size: string; created: string; name: string };

export default function App() {
  const [loading, setLoading] = useState<ListType | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [otherFile, setOtherFile] = useState<DownloadInfo | null>(null);
  const busy = useRef(false);

  async function download(type: ListType) {
    if (busy.current) return;
    busy.current = true;
    setLoading(type);
    setError("");
    setNotice("");
    try {
      const [data, { createTerminalListPdf }, translations] = await Promise.all([
        generateDailyEvents(type),
        import("./utils/terminal-list-pdf"),
        loadPdfTranslations()
      ]);
      const blob = createTerminalListPdf(data, undefined, translations).output("blob");
      const now = new Date();
      const date = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Belgrade",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      })
        .format(now)
        .replaceAll("/", "-");
      const name =
        type === 1 ? "terminska.pdf" : `termini-ostali-sportovi-${date}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (type === 2)
        setOtherFile({
          name,
          size:
            blob.size >= 1024 * 1024
              ? `${(blob.size / 1024 / 1024).toFixed(1)} MB`
              : `${(blob.size / 1024).toFixed(1)} KB`,
          created: new Intl.DateTimeFormat("sr-Latn-ME", {
            timeZone: "Europe/Belgrade",
            dateStyle: "short",
            timeStyle: "medium"
          }).format(now)
        });
      setNotice("PDF je generisan. Preuzimanje je pokrenuto.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Preuzimanje nije uspelo. Pokušajte ponovo."
      );
    } finally {
      busy.current = false;
      setLoading(null);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>DOPUNE / LISTE</h1>
        <button
          className="download-button"
          disabled={loading !== null}
          onClick={() => void download(1)}
        >
          {loading === 1 && <span className="spinner" aria-hidden="true" />}
          {loading === 1 ? "Generisanje PDF-a…" : "Preuzmi terminsku"}
        </button>
      </header>
      <div className="table-wrapper" aria-busy={loading !== null}>
        <table>
          <caption className="sr-only">
            Preuzimanje liste za ostale sportove
          </caption>
          <thead>
            <tr>
              <th scope="col">Ime datoteke</th>
              <th scope="col">Veličina</th>
              <th scope="col">Vreme generisanja</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <button
                  className="file-link"
                  disabled={loading !== null}
                  onClick={() => void download(2)}
                >
                  {loading === 2
                    ? "Generisanje PDF-a…"
                    : (otherFile?.name ?? "Ostali sportovi — preuzmi PDF")}
                </button>
              </td>
              <td>{otherFile?.size ?? "—"}</td>
              <td>{otherFile?.created ?? "Generiše se na zahtev"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="status" role="status" aria-live="polite">
        {loading !== null
          ? "Pripremamo aktuelnu listu. Molimo sačekajte…"
          : notice}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer>
        Copyright © {new Date().getFullYear()}{" "}
        <a href="https://premierbet.me">premierbet.me</a>
      </footer>
    </main>
  );
}
