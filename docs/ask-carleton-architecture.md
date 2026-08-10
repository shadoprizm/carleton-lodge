# Lodge Guide architecture

## Product decision

Lodge Guide will be a member knowledge assistant, not a general-purpose chatbot.
Its job is to help a member locate and understand current, approved lodge
information without requiring them to know whether it lives in the calendar,
summons, document library, directory, or help content.

The assistant will initially be available only to authenticated lodge members.
A limited public visitor assistant can be evaluated later using a separate,
explicitly public source collection.

The interface is protected by `VITE_ASK_CARLETON_ENABLED` and remains absent
from navigation and routing until the production evaluation gate passes.

## Non-negotiable behaviour

- Answer only from source excerpts retrieved for the current user.
- Cite every material answer with a direct link to its event, summons, document,
  directory entry, or help article.
- Say when the approved sources do not contain a reliable answer.
- Offer a clearly labelled path to contact a person.
- Respect the same audience and role rules as the underlying source.
- Treat source text as untrusted data, not as instructions to the model.
- Never publish, edit, approve, email, RSVP, or perform another action.
- Never provide ritual or other restricted material unless it is present in an
  approved source the current member is authorized to read.
- Avoid storing full conversations by default. Retain only the minimum feedback
  and audit data approved by the lodge.

## Source and retrieval boundary

The source-of-truth work comes first. Approved content will be normalized into a
permission-aware knowledge index containing:

- source type and source ID;
- title, canonical site path, and last-updated time;
- audience (`public`, `members`, or a restricted administrative audience);
- normalized searchable text;
- optional chunks and embeddings for semantic retrieval;
- publication and expiry state.

Retrieval will be hybrid: PostgreSQL full-text search for exact lodge terms and
optional pgvector similarity for natural-language questions. Access filtering
must happen in PostgreSQL before any excerpt is sent to an AI provider. A model
must never be asked to decide whether the user is allowed to see a source.

## Request flow

1. The browser sends the member's question to a Supabase Edge Function.
2. The function validates the Supabase user and applies rate limits.
3. PostgreSQL returns only source excerpts the user may read.
4. The function sends the question and bounded excerpts to the OpenAI Responses
   API with a strict citation-oriented output contract.
5. The response returns answer text, source IDs, direct site links, and an
   explicit `answerable` state.
6. The interface renders sources beside the answer and always exposes human help.

The model is configured through an Edge Function secret rather than hard-coded.
The current flagship candidate is `gpt-5.6-sol`; the balanced and high-volume
family tiers will be evaluated on representative lodge questions before a
production default is chosen.

## Evaluation gate

The assistant does not launch until it passes a lodge-owned evaluation set that
includes:

- next meeting date, time, location, dress, and status;
- latest summons and minutes;
- officer and contact questions;
- exact-form and policy retrieval;
- stale, missing, ambiguous, and conflicting information;
- attempted access to another audience's content;
- prompt injection embedded in a document;
- requests to take an action;
- questions that require human Masonic judgment.

Required launch outcomes are zero permission leaks, citations on every factual
answer, reliable abstention when evidence is missing, and a clear route to a
human when the assistant cannot help.
