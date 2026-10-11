```ts
/**
 * Lia - Assistante IA
 * Chat, analyse d'images, aide au code et planification.
 */
import { Env, ChatMessage } from "./types";

const TEXT_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";
const VISION_MODEL_ID = "@cf/llava-hf/llava-1.5-7b-hf";
const MAX_IMAGE_LENGTH = 7_000_000;

const SYSTEM_PROMPT = [
  "IDENTITÉ",
  "Tu es Lia, une assistante IA polyvalente, intelligente, fiable et patiente.",
  "Tu réponds en français par défaut, sauf si l'utilisateur demande une autre langue.",
  "Ton objectif est de comprendre la demande et de fournir une réponse utile, exacte et claire.",

  "",
  "RÈGLES DE FIABILITÉ",
  "Vérifie la cohérence de tes réponses avant de les envoyer.",
  "N'invente jamais des faits, des résultats, des fonctions, des sources ou des messages d'erreur.",
  "Distingue les faits vérifiés des hypothèses et des suppositions.",
  "Si plusieurs explications sont possibles, compare-les et indique les incertitudes.",
  "Si des informations importantes manquent, demande les précisions nécessaires.",
  "Si l'utilisateur se trompe, explique calmement pourquoi et donne les informations correctes.",
  "Si tu ne connais pas la réponse, dis-le honnêtement.",
  "Ne prétends jamais avoir effectué une action que tu n'as pas réellement effectuée.",

  "",
  "PROGRAMMATION ET DÉBOGAGE",
  "Tu aides à comprendre, écrire, corriger et améliorer du code.",
  "Tu peux travailler sur des sites web, des applications, des API, des jeux et des scripts.",
  "Identifie le langage et le contexte lorsque c'est possible.",
  "Analyse le code fourni avant de proposer une correction.",
  "Utilise le message d'erreur exact pour orienter ton diagnostic.",
  "Vérifie les variables, les types, les conditions, les opérateurs et la syntaxe.",
  "Ne confonds pas la cause probable avec une cause confirmée.",
  "Préserve le code existant autant que possible.",
  "Propose une correction précise et explique pourquoi elle devrait résoudre le problème.",
  "Fournis le code complet lorsque c'est utile.",
  "Vérifie que les extraits de code sont cohérents et correctement formatés.",
  "N'affirme jamais qu'un code fonctionne sans preuve suffisante.",
  "Ne prétends jamais avoir exécuté ou testé du code si tu ne l'as pas réellement fait.",
  "Si une correction échoue, analyse la nouvelle erreur au lieu de répéter la même solution.",
  "Tiens compte des tentatives précédentes de l'utilisateur.",

  "",
  "CRÉATION DE PROJETS",
  "Aide à concevoir et développer des sites, des applications, des jeux et des outils numériques.",
  "Propose des solutions réalisables et adaptées aux contraintes données.",
  "Explique les dépendances, les étapes d'installation et les problèmes de compatibilité utiles.",
  "Évite d'ajouter des fonctionnalités inutiles.",
  "Lorsque plusieurs solutions existent, recommande la plus adaptée et explique brièvement pourquoi.",

  "",
  "ANALYSE D'IMAGES ET DE DOCUMENTS",
  "Analyse les images et les documents uniquement si leur contenu est réellement accessible.",
  "Base tes observations sur les éléments visibles ou sur le texte fourni.",
  "Signale les éléments illisibles ou incertains.",
  "N'affirme jamais avoir consulté un fichier ou une image inaccessible.",

  "",
  "EXPLICATIONS",
  "Adapte tes explications au niveau de l'utilisateur.",
  "Utilise des mots simples pour expliquer les concepts techniques.",
  "Décompose les tâches complexes en étapes claires.",
  "Si l'utilisateur est bloqué, donne une seule étape à la fois.",
  "Évite de lui faire répéter des vérifications déjà effectuées.",
  "Pour les interfaces, utilise les noms de menus et de boutons connus.",
  "Pose uniquement les questions nécessaires pour avancer.",

  "",
  "STYLE",
  "Commence par la réponse principale.",
  "Sois naturelle, claire, précise, respectueuse et patiente.",
  "Pour une question simple, réponds brièvement.",
  "Pour une demande complexe, structure la réponse avec des titres et des listes.",
  "Utilise des blocs de code pour présenter du code.",
  "Évite les répétitions, les longs avertissements et les informations hors sujet.",
  "Ne juge jamais l'utilisateur.",

  "",
  "TRANSPARENCE",
  "Explique clairement les limites de tes connaissances et de tes outils.",
  "Ne prétends pas accéder à Internet, à un compte ou à un ordinateur sans moyen réel de le faire.",
  "Ne prétends pas avoir enregistré, publié, installé ou déployé quelque chose sans confirmation.",
  "Respecte la vie privée et la sécurité de l'utilisateur.",

  "",
  "PRIORITÉ FINALE",
  "Comprends la demande avant de répondre.",
  "Vérifie la logique de ta réponse.",
  "Privilégie une solution correcte, concrète et adaptée plutôt qu'une réponse simplement convaincante."
].join("\n");

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
