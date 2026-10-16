import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  MessageCircle,
  Plus,
  Search,
  Send,
  Smile,
  Users,
  Video,
} from "lucide-react";
export const Route = createFileRoute("/")({ component: Home });
function Home() {
  return (
    <div className="landing">
      <header className="site-header">
        <Link to="/" className="wordmark">
          Alloo<span className="wordmark-dot">.</span>
        </Link>
        <nav>
          <a href="#pourquoi">Pourquoi Alloo</a>
          <a
            href={`${import.meta.env.VITE_APP_ORIGIN ?? "http://127.0.0.1:3000"}/app`}
            className="button small-button"
          >
            Ouvrir Alloo <ArrowUpRight size={16} />
          </a>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="pill">
              <span className="status-dot" /> Moins de bruit. Plus de liens.
            </div>
            <h1>
              Juste discuter.
              <br />
              <span>Rien d’autre.</span>
            </h1>
            <p>
              Les conversations qui comptent méritent un endroit simple. Retrouvez vos proches,
              échangez un message, passez un appel. Et profitez du moment.
            </p>
            <a
              href={`${import.meta.env.VITE_APP_ORIGIN ?? "http://127.0.0.1:3000"}/app`}
              className="button primary hero-cta"
            >
              On se dit Alloo ? <ArrowRight size={18} />
            </a>
            <div className="hero-note">Dans votre navigateur. À votre rythme.</div>
          </div>
          <div className="preview-wrap">
            <div className="preview-caption">
              <span className="status-dot" /> Un petit aperçu de votre prochain « alloo »
            </div>
            <div
              className="chat-preview"
              role="img"
              aria-label="Illustration d’une conversation fictive"
            >
              <aside className="preview-sidebar">
                <div className="preview-title">
                  Messages <Plus size={16} />
                </div>
                <div className="preview-search">
                  <Search size={13} /> Rechercher
                </div>
                {[
                  ["C", "Camille", "On se retrouve là-bas ?", "active"],
                  ["L", "Les copains", "Léa : Ça marche !", ""],
                  ["M", "Martin", "À demain 👋", ""],
                ].map(([initial, name, text, active]) => (
                  <div key={name} className={`preview-person ${active}`}>
                    <div className="avatar">{initial}</div>
                    <div>
                      <strong>{name}</strong>
                      <small>{text}</small>
                    </div>
                  </div>
                ))}
              </aside>
              <div className="preview-chat">
                <div className="preview-chat-header">
                  <div className="avatar">C</div>
                  <div>
                    <strong>Camille</strong>
                    <small>
                      <span className="status-dot" /> En ligne
                    </small>
                  </div>
                  <Video size={19} />
                </div>
                <div className="preview-messages">
                  <span className="date-label">Aujourd’hui</span>
                  <div className="bubble incoming">
                    Alloo ! Une pause café cet après-midi ? ☕<small>14:32</small>
                  </div>
                  <div className="bubble outgoing">
                    Toujours partant pour un café.
                    <br />
                    Le petit endroit près du parc ?
                    <small>
                      14:33 <CheckCheck size={12} />
                    </small>
                  </div>
                  <div className="bubble incoming">
                    Exactement ! On se retrouve là-bas ?<small>14:33</small>
                  </div>
                  <div className="typing-dots">•••</div>
                </div>
                <div className="preview-composer">
                  <Plus size={17} />
                  <span>Écrire un message…</span>
                  <Smile size={17} />
                  <div className="send-icon">
                    <Send size={15} />
                  </div>
                </div>
              </div>
            </div>
            <div className="preview-footnote">
              Des échanges simples. Comme ils devraient l’être.
            </div>
          </div>
        </section>
        <section id="pourquoi" className="benefits">
          <div className="benefits-intro">
            <span className="eyebrow">L’ESSENTIEL, BIEN FAIT</span>
            <h2>
              Plus proches.
              <br />
              Moins distraits.
            </h2>
          </div>
          {[
            [
              MessageCircle,
              "La place aux mots.",
              "Des messages privés, sans fil d’actualité à parcourir. Votre attention reste avec la bonne personne.",
            ],
            [
              Users,
              "Votre petit monde.",
              "Des groupes pour les amis, la famille et les projets qui vous rassemblent.",
            ],
            [
              Video,
              "Une voix, un visage.",
              "Quand les mots ne suffisent plus, retrouvez-vous en appel audio ou vidéo.",
            ],
          ].map(([Icon, title, body]) => {
            const ItemIcon = Icon as typeof MessageCircle;
            return (
              <article key={String(title)}>
                <div className="feature-icon">
                  <ItemIcon size={22} />
                </div>
                <h3>{String(title)}</h3>
                <p>{String(body)}</p>
              </article>
            );
          })}
        </section>
        <section className="closing">
          <h2>
            Une conversation commence
            <br />
            toujours par un petit mot.
          </h2>
          <a
            href={`${import.meta.env.VITE_APP_ORIGIN ?? "http://127.0.0.1:3000"}/app`}
            className="button primary"
          >
            Dites Alloo <ArrowUpRight size={17} />
          </a>
        </section>
      </main>
      <footer className="site-footer">
        <span className="wordmark">Alloo.</span>
        <span>Un peu moins de bruit, un peu plus de vous.</span>
        <a href="/privacy">Confidentialité</a>
        <a href="/support">Aide</a>
      </footer>
    </div>
  );
}
