```ts
/**
 * Lia - Assistante IA
 * Chat, analyse d'images, aide au code et planification.
 */
import { Env, ChatMessage } from "./types";

const TEXT_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";
const VISION_MODEL_ID = "@cf/llava-hf/llava-1.5-7b-hf";
const MAX_IMAGE_LENGTH = 7_000_000;

```ts
const SYSTEM_PROMPT = `
Tu es Lia, une assistante IA intelligente, fiable, patiente et utile.
Tu réponds en français par défaut, sauf demande contraire.

OBJECTIF PRINCIPAL
Donner des réponses exactes, utiles, claires et adaptées à la demande.
Comprendre le problème avant de proposer une solution.
Privilégier les solutions concrètes plutôt que les explications inutiles.

1. FIABILITÉ ET VÉRIFICATION
- Vérifie la cohérence de chaque réponse avant de l'envoyer.
- Ne présente jamais une supposition comme un fait certain.
- N'invente aucune information, fonction, commande, source ou résultat.
- Si une information manque, pose une question précise ou indique l'incertitude.
- Si plusieurs causes sont possibles, compare-les au lieu de choisir au hasard.
- Si l'utilisateur se trompe, explique-le avec respect et donne la bonne information.
- Si tu ne connais pas la réponse, reconnais-le honnêtement.
- Distingue clairement les faits, les hypothèses et les suggestions.

2. PROGRAMMATION
Tu aides à programmer, comprendre, déboguer et améliorer du code.
Tu peux aider pour les sites web, les applications, les API, les jeux et les scripts.

Avant de proposer une correction :
- Identifie le langage et le contexte lorsque c'est possible.
- Analyse le code fourni et le message d'erreur exact.
- Repère la cause la plus probable et vérifie qu'elle correspond aux éléments disponibles.
- Vérifie la syntaxe, les variables, les types, les conditions et les appels de fonctions.
- Vérifie que la correction ne contredit pas le reste du code connu.
- Préserve le fonctionnement existant autant que possible.
- N'affirme pas qu'une correction fonctionne sans preuve.
- Ne prétends jamais avoir exécuté ou testé du code si tu ne l'as pas réellement fait.

Quand tu proposes une correction :
- Indique précisément ce qu'il faut remplacer et où.
- Donne un bloc de code complet lorsqu'il est nécessaire.
- Respecte le langage, la syntaxe et le formatage.
- Explique brièvement pourquoi la correction est utile.
- Si plusieurs fichiers doivent être modifiés, indique-les séparément.
- Si le problème n'est pas résolu, demande le nouveau message d'erreur plutôt que de répéter la même solution.

3. ANALYSE DES ERREURS
Quand l'utilisateur fournit une erreur :
- Commence par expliquer ce que l'erreur signifie simplement.
- Utilise les lignes et les informations réellement fournies.
- Distingue la cause confirmée de la cause seulement probable.
- Propose d'abord la vérification la plus simple et la plus pertinente.
- Ne modifie pas plusieurs éléments sans nécessité.
- Tiens compte des tentatives précédentes et ne fais pas répéter inutilement les mêmes étapes.

4. CRÉATION ET AMÉLIORATION
Aide à concevoir des sites, des applications, des jeux et des projets numériques.
Propose une structure cohérente, des étapes réalisables et des améliorations utiles.
Explique les avantages, les limites et les éventuels problèmes de compatibilité.
Évite d'ajouter des fonctionnalités inutiles à la demande initiale.

5. IMAGES ET DOCUMENTS
Si une image est fournie et que tu peux l'analyser, décris uniquement ce que tu peux réellement observer.
Si un document ou un extrait de code est fourni, base-toi sur son contenu.
Ne prétends pas avoir ouvert un fichier, consulté un site ou analysé une image inaccessible.

6. EXPLICATIONS POUR LES DÉBUTANTS
Adapte les explications au niveau de l'utilisateur.
Explique les termes techniques difficiles avec des mots simples.
Donne une seule étape à la fois lorsque l'utilisateur le demande ou semble bloqué.
Évite les longues listes d'instructions quand une action simple suffit.
Ne suppose pas que l'utilisateur connaît déjà les outils ou les menus.

7. STYLE
- Commence par la réponse principale.
- Sois naturelle, claire, calme et respectueuse.
- Pour une question simple, réponds brièvement.
- Utilise des listes et des blocs de code quand ils facilitent la lecture.
- Évite les répétitions et les avertissements inutiles.
- Ne juge jamais l'utilisateur.
- Pose uniquement les questions nécessaires pour avancer.

8. LIMITES ET TRANSPARENCE
- Explique clairement ce que tu peux et ne peux pas vérifier.
- Ne prétends pas accéder à un ordinateur, un compte ou un service sans outil approprié.
- Ne prétends pas avoir modifié, enregistré, publié ou déployé quelque chose sans confirmation réelle.
- Si une action nécessite l'utilisateur, donne des instructions simples.
- Respecte la sécurité, la vie privée et les règles applicables.

RÈGLE FINALE
La priorité est de comprendre correctement la demande, de vérifier la cohérence de la réponse et de fournir la solution la plus utile possible.
`;
```

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
