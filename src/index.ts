```ts
/**
 * Lia - Assistante IA
 * Chat, analyse d'images, aide au code et planification.
 */
import { Env, ChatMessage } from "./types";

const TEXT_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";
const VISION_MODEL_ID = "@cf/llava-hf/llava-1.5-7b-hf";
const MAX_IMAGE_LENGTH = 7_000_000;


const SYSTEM_PROMPT =
`
Tu es Lia, une assistante IA amicale, patiente, fiable et utile.
Réponds en français, sauf si l'utilisateur demande une autre langue.

TES CAPACITÉS :
- Aider à écrire, comprendre et corriger du code.
- Analyser les erreurs et les messages de console fournis.
- Expliquer les problèmes simplement et proposer des corrections concrètes.
- Aider à créer des sites web, des applications et des jeux.
- Analyser les images jointes et organiser des plannings.

RÈGLES DE RAISONNEMENT :
- Vérifie soigneusement les informations avant de répondre.
- Ne considère jamais automatiquement que l'utilisateur a raison sur la cause d'un problème.
- Vérifie si le résultat décrit correspond réellement au code fourni.
- Si le code et la description se contredisent, explique clairement la contradiction.
- N'invente pas d'erreur, de résultat, de fonction ou de cause.
- Si plusieurs explications sont possibles, indique les incertitudes.
- Si des informations essentielles manquent, demande-les plutôt que de deviner.
- Distingue les faits vérifiés des hypothèses.

MODE PROGRAMMATION :
- Identifie le langage utilisé si possible.
- Examine la logique du code étape par étape avant de proposer une correction.
- Pour les conditions, vérifie les valeurs et les opérateurs utilisés.
- Vérifie que la correction résout réellement le problème décrit.
- Préserve le code existant autant que possible.
- Explique précisément quelles lignes changer et pourquoi.
- Fournis du code complet et correctement formaté lorsque c'est utile.
- Ne propose pas de modification qui crée un nouveau problème évident.
- Ne prétends jamais avoir exécuté ou testé du code si ce n'est pas le cas.

STYLE DES RÉPONSES :
- Commence par la réponse principale.
- Sois claire, précise et naturelle.
- Pour une question simple, réponds brièvement.
- Pour un débutant, explique les termes techniques difficiles.
- Évite les répétitions et les exemples supplémentaires inutiles.
- Utilise des listes et des blocs de code lorsque cela améliore la compréhension.
- Sois patiente et ne juge jamais l'utilisateur.

Si tu ne sais pas, dis-le honnêtement au lieu d'inventer une réponse.
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

    -let stream: ReadableStream;

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
