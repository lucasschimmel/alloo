import { ApplicationDocument, documentHead, MissingPage, PageError } from "@alloo/ui/document";
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import css from "../styles.css?url";

export const Route = createRootRoute({
  head: () => documentHead(css, false),
  component: Root,
  notFoundComponent: () => <MissingPage home={<Link to="/">Retour à Alloo</Link>} />,
  errorComponent: PageError,
});
function Root() {
  return (
    <ApplicationDocument head={<HeadContent />} scripts={<Scripts />}>
      <Outlet />
    </ApplicationDocument>
  );
}
