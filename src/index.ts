```ts
/**
 * Lia - Assistante IA
 * Chat, analyse d'images, aide au code et planification.
 */
import { Env, ChatMessage } from "./types";

const TEXT_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";
const VISION_MODEL_ID = "@cf/llava-hf/llava-1.5-7b-hf";
const MAX_IMAGE_LENGTH = 7_000_000;

const SYSTEM_PROMPT = `
Tu es Lia, une assistante IA amicale, patiente et utile.
Réponds en français, sauf si l'utilisateur demande une autre langue.

TES CAPACITÉS :
- Aider à écrire, comprendre et corriger du code.
- Analyser les erreurs et les messages de console fournis par l'utilisateur.
- Proposer des corrections de code adaptées au langage utilisé.
- Expliquer le rôle de chaque modification.
- Aider à créer des sites web, des applications et des petits jeux.
- Analyser les images jointes et créer des plannings organisés.

MODE PROGRAMMATION :
- Si le code ou le message d'erreur manque, demande-le à l'utilisateur.
- Identifie le langage de programmation si possible.
- Explique simplement d'où vient le problème.
- Propose une correction concrète et indique où l'appliquer.
- Quand plusieurs fichiers sont concernés, traite-les un par un.
- Pour un débutant, avance étape par étape et évite le jargon inutile.
- Préserve le code existant autant que possible.
- Ne prétends jamais avoir testé, exécuté ou réparé du code si ce n'est pas le cas.
- Signale clairement les incertitudes et les risques de casser une fonctionnalité.

Sois claire, patiente et adaptée aux besoins de l'utilisateur.
`;

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/chat") {
      if (request.method !== "POST") {
        return new Response("Méthode non autorisée", { status: 405 });
      }

      return handleChatRequest(request, env);
    }

    return new Response("Page introuvable", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleChatRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    const body = (await request.json()) as {
      messages?: ChatMessage[];
      image?: unknown;
    };

    const messages = Array.isArray(body.messages)
      ? [...body.messages]
      : [];

    const image = body.image;

    if (image !== undefined && typeof image !== "string") {
      return Response.json(
        { error: "Le format de l'image est invalide." },
        { status: 400 },
      );
    }

    if (typeof image === "string") {
      if (image.length > MAX_IMAGE_LENGTH) {
        return Response.json(
          { error: "L'image est trop volumineuse. Choisis une image plus petite." },
          { status: 413 },
        );
      }

      if (!/^data:image\/(?:png|jpeg|webp);base64,/i.test(image)) {
        return Response.json(
          { error: "Utilise une image PNG, JPEG ou WebP." },
          { status: 400 },
        );
      }
    }

    if (!messages.some((message) => message.role === "system")) {
      messages.unshift({
        role: "system",
        content: SYSTEM_PROMPT,
      });
    }

    let stream: ReadableStream;

    
    let stream: ReadableStream;

    if (typeof image === "string") {
      const base64 = image.slice(image.indexOf(",") + 1);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);

      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const lastMessage = [...messages]
        .reverse()
        .find((message) => message.role === "user");

      const prompt =
        typeof lastMessage?.content === "string"
          ? lastMessage.content
          : "Décris cette image en français.";

      const result = await env.AI.run<typeof VISION_MODEL_ID>(
        VISION_MODEL_ID,
        {
          prompt,
          image: [...bytes],
          max_tokens: 1024,
        },
      );

      const answer =
        typeof result === "object" &&
        result !== null &&
        "description" in result
          ? String(result.description)
          : JSON.stringify(result);

      stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ response: answer })}\n\n`,
            ),
          );
          controller.enqueue(
            new TextEncoder().encode("data: [DONE]\n\n"),
          );
          controller.close();
        },
      });
    } else {
      stream = await env.AI.run<typeof TEXT_MODEL_ID>(
        TEXT_MODEL_ID,
        {
          messages,
          max_tokens: 1024,
          stream: true,
        },
      );
    }

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  } catch (erreur) {
    console.error("Erreur de Lia :", erreur);

    const detail =
      erreur instanceof Error ? erreur.message : String(erreur);

    return Response.json(
      {
        error: `Lia n'a pas pu répondre. Erreur : ${detail.slice(0, 250)}`,
      },
      { status: 500 },
    );
  }
}
```
