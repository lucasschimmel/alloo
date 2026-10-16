import { httpRouter } from "convex/server";
import { download, options, upload } from "./attachmentHttp";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/attachments", method: "POST", handler: upload });
http.route({ path: "/attachments", method: "GET", handler: download });
http.route({ path: "/attachments", method: "OPTIONS", handler: options });
export default http;
