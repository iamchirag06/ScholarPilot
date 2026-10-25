"""LangChain-powered scholarship chatbot service with contextual profile and matched schemes retrieval."""

import os
import json
import asyncio
import logging
from typing import Dict, Any, List, Optional, AsyncGenerator
import httpx
from sqlalchemy.orm import Session

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from src.scholarpilot_ai.config import get_settings
from src.scholarpilot_ai.db.models import ProfileModel, ScoreModel, SchemeModel
from src.scholarpilot_ai.data.seed_profiles import SEED_PROFILES
from src.scholarpilot_ai.data.seed_schemes import SEED_SCHEMES

logger = logging.getLogger(__name__)
settings = get_settings()


class ScholarshipChatbotService:
    """Manages student profile & matched schemes retrieval and streams LangChain answers."""

    @classmethod
    async def fetch_user_profile(
        cls,
        profile_id: str,
        db: Optional[Session] = None,
    ) -> Optional[Dict[str, Any]]:
        """Fetch student profile data from {BACKEND_URL}/api/profiles/{profileId} with local DB fallback."""
        backend_url = settings.effective_backend_url.rstrip("/")
        target_url = f"{backend_url}/api/profiles/{profile_id}"

        # 1. Try remote Spring Boot backend
        headers = {
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "ScholarPilot/1.0",
            "Accept": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(target_url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    logger.info(f"Fetched profile '{profile_id}' from backend {target_url}")
                    if isinstance(data, dict):
                        if "data" in data and isinstance(data["data"], dict):
                            return data["data"]
                        if "profile" in data and isinstance(data["profile"], dict):
                            return data["profile"]
                    return data
        except Exception as e:
            logger.debug(f"Could not reach {target_url} ({e}); trying local fallback.")

        # 2. Local database fallback
        if db:
            try:
                prof = db.query(ProfileModel).filter(ProfileModel.id == profile_id).first()
                if prof:
                    return prof.to_dict()
            except Exception:
                pass

        # 3. Seed profiles fallback
        for sp in SEED_PROFILES:
            if sp.get("id") == profile_id:
                return sp

        # 4. Safe default profile representation for user
        return {
            "id": profile_id,
            "name": f"Student ({profile_id})",
            "state": "India",
            "education_level": "Undergraduate",
        }

    @classmethod
    async def fetch_matched_schemes(
        cls,
        profile_id: str,
        db: Optional[Session] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch matched scholarship schemes from {BACKEND_URL}/api/schemes/matched/{profileId} with local DB fallback."""
        backend_url = settings.effective_backend_url.rstrip("/")
        target_url = f"{backend_url}/api/schemes/matched/{profile_id}"

        # 1. Try remote Spring Boot backend
        headers = {
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "ScholarPilot/1.0",
            "Accept": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(target_url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    if isinstance(data, list):
                        return data
                    if isinstance(data, dict):
                        return data.get("schemes") or data.get("recommendations") or data.get("items") or data.get("data") or []
        except Exception as e:
            logger.debug(f"Could not reach {target_url} ({e}); trying local fallback.")

        # 2. Local database fallback (ScoreModel joined with SchemeModel)
        if db:
            try:
                scores = (
                    db.query(ScoreModel)
                    .filter(ScoreModel.profile_id == profile_id)
                    .order_by(ScoreModel.match_score.desc())
                    .all()
                )
                if scores:
                    scheme_ids = [s.scheme_id for s in scores]
                    schemes = db.query(SchemeModel).filter(SchemeModel.id.in_(scheme_ids)).all()
                    schemes_map = {s.id: s.to_dict() for s in schemes}

                    matched: List[Dict[str, Any]] = []
                    for sc in scores:
                        base_scheme = schemes_map.get(sc.scheme_id, {})
                        item = dict(base_scheme)
                        item["match_score"] = sc.match_score
                        item["eligibility_status"] = sc.eligibility_status
                        if sc.reasons and isinstance(sc.reasons, dict):
                            item["summary"] = sc.reasons.get("summary")
                            item["why_relevant"] = sc.reasons.get("why_relevant")
                        matched.append(item)
                    return matched
            except Exception:
                pass

        # 3. Benchmark seed schemes fallback
        return list(SEED_SCHEMES[:4])

    @classmethod
    def format_context_string(
        cls,
        profile: Optional[Dict[str, Any]],
        schemes: List[Dict[str, Any]],
    ) -> str:
        """Construct structured context string from profile and matched schemes."""
        context_parts: List[str] = []

        # Profile context
        if profile:
            name = profile.get("name") or profile.get("full_name") or profile.get("id") or "Student"
            state = profile.get("state") or "India"
            edu = profile.get("education_level") or "N/A"
            course = profile.get("course") or "N/A"
            cat = profile.get("category") or "General"
            inc = profile.get("annual_family_income_inr") or profile.get("income_inr") or "Not provided"
            marks = profile.get("academic_percentage") or profile.get("marks_percent") or "Not provided"

            context_parts.append(
                "=== STUDENT PROFILE ===\n"
                f"• Student ID: {profile.get('id', 'N/A')}\n"
                f"• Name: {name}\n"
                f"• Domicile State: {state}\n"
                f"• Education Level: {edu}\n"
                f"• Course / Major: {course}\n"
                f"• Social Category: {cat}\n"
                f"• Family Annual Income: ₹{inc:,}" if isinstance(inc, (int, float)) else f"• Family Annual Income: {inc}\n"
                f"• Academic Marks / Percentage: {marks}%\n"
            )
        else:
            context_parts.append("=== STUDENT PROFILE ===\n• Profile details not currently loaded.\n")

        # Matched schemes context
        if schemes:
            context_parts.append("=== MATCHED SCHOLARSHIP SCHEMES ===")
            for idx, s in enumerate(schemes, start=1):
                title = s.get("title") or s.get("scheme_name") or "Scholarship Scheme"
                prov = s.get("provider") or "Official Department"
                award = s.get("award_amount_inr") or s.get("award_amount")
                award_str = f"₹{award:,}" if award and isinstance(award, (int, float)) else "Tuition support / grant"
                deadline = s.get("deadline") or "Ongoing / Open"
                status = s.get("eligibility_status") or "ELIGIBLE"
                score = s.get("match_score") or s.get("rank_score")
                score_str = f"Match Score: {score:.1f}" if score else ""
                url = s.get("official_url") or s.get("apply_link") or "https://scholarships.gov.in"
                docs = s.get("required_documents") or []
                docs_str = ", ".join(docs) if isinstance(docs, list) and docs else "Standard verification documents"
                summary = s.get("summary") or s.get("llm_summary") or ""

                context_parts.append(
                    f"\nScheme #{idx}: {title}\n"
                    f"  - Provider: {prov}\n"
                    f"  - Award: {award_str}\n"
                    f"  - Deadline: {deadline}\n"
                    f"  - Status: {status} {score_str}\n"
                    f"  - Required Documents: {docs_str}\n"
                    f"  - Application Link: {url}\n"
                    f"  - Details: {summary}\n"
                )
        else:
            context_parts.append("=== MATCHED SCHOLARSHIP SCHEMES ===\n• No matched schemes currently loaded for this profile.\n")

        return "\n".join(context_parts)

    @classmethod
    async def _stream_gemini_response(
        cls,
        system_instruction: str,
        messages: List[Any],
        api_key: str,
        model_name: str,
    ) -> AsyncGenerator[str, None]:
        """Stream response tokens using LangChain ChatGoogleGenerativeAI."""
        from langchain_google_genai import ChatGoogleGenerativeAI

        # Only attempt if it is a valid Google AI Studio key format
        if not api_key or not api_key.startswith("AIzaSy"):
            raise ValueError("Invalid Gemini API key format (must start with AIzaSy)")

        clean_model = model_name
        if "3.8" in clean_model or not clean_model:
            clean_model = "gemini-1.5-flash"

        llm = ChatGoogleGenerativeAI(
            model=clean_model,
            google_api_key=api_key,
            temperature=0.2,
            timeout=4.0,
            max_retries=0,
        )

        full_msgs = [SystemMessage(content=system_instruction)] + messages
        async for chunk in llm.astream(full_msgs):
            if chunk.content:
                yield str(chunk.content)

    @classmethod
    async def _stream_groq_response(
        cls,
        system_instruction: str,
        history: List[Dict[str, str]],
        query: str,
        api_key: str,
        model_name: str,
    ) -> AsyncGenerator[str, None]:
        """Stream response tokens from Groq via async HTTP SSE streaming with multi-model fallback."""
        groq_messages = [{"role": "system", "content": system_instruction}]
        for h in history:
            role = "assistant" if h.get("role") in ["assistant", "ai"] else "user"
            groq_messages.append({"role": role, "content": h.get("content", "")})
        groq_messages.append({"role": "user", "content": query})

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        # Multi-model fallback list in order of verified speed and availability
        candidate_models: List[str] = []
        if model_name and model_name not in ["llama-3.1-8b-instant"]:
            candidate_models.append(model_name)
        candidate_models.extend(["qwen/qwen3.8-27b", "openai/gpt-oss-20b", "openai/gpt-oss-120b"])
        if model_name and model_name not in candidate_models:
            candidate_models.append(model_name)

        tokens_streamed = 0
        for m in candidate_models:
            payload = {
                "model": m,
                "messages": groq_messages,
                "temperature": 0.2,
                "stream": True,
            }

            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    async with client.stream("POST", url, headers=headers, json=payload) as response:
                        if response.status_code == 200:
                            async for line in response.aiter_lines():
                                if line.startswith("data: ") and not line.startswith("data: [DONE]"):
                                    try:
                                        chunk_json = json.loads(line[6:])
                                        delta = chunk_json["choices"][0].get("delta", {})
                                        content = delta.get("content")
                                        if content:
                                            tokens_streamed += 1
                                            yield content
                                    except Exception:
                                        continue
                            if tokens_streamed > 0:
                                return
                        else:
                            logger.warning(f"Groq model '{m}' returned status {response.status_code}, trying next model.")
            except Exception as e:
                logger.warning(f"Groq stream with model '{m}' failed: {e}")

        if tokens_streamed == 0:
            raise RuntimeError("All Groq streaming attempts returned zero tokens.")

    @classmethod
    async def _stream_deterministic_fallback(
        cls,
        query: str,
        profile: Optional[Dict[str, Any]],
        schemes: List[Dict[str, Any]],
    ) -> AsyncGenerator[str, None]:
        """Grounded factual streaming fallback when external LLM providers are unavailable."""
        query_lower = query.lower()
        parts: List[str] = []

        student_name = profile.get("name") or "Student" if profile else "Student"

        # Check query intent
        if any(w in query_lower for w in ["award", "amount", "money", "highest", "financial", "grant"]):
            parts.append(f"Hello {student_name}! Based on your matched scholarship opportunities:\n\n")
            if schemes:
                sorted_schemes = sorted(
                    schemes,
                    key=lambda s: float(s.get("award_amount_inr") or s.get("award_amount") or 0),
                    reverse=True,
                )
                top = sorted_schemes[0]
                top_award = top.get("award_amount_inr") or top.get("award_amount")
                top_title = top.get("title") or top.get("scheme_name")
                parts.append(f"• **Top Financial Award**: **{top_title}** offering **₹{top_award:,}** per year.\n")
                for s in sorted_schemes[1:]:
                    title = s.get("title") or s.get("scheme_name")
                    awd = s.get("award_amount_inr") or s.get("award_amount")
                    awd_str = f"₹{awd:,}" if awd else "Tuition grant"
                    parts.append(f"• **{title}**: {awd_str}\n")
            else:
                parts.append("Currently no specific financial award figures were found in your matched schemes.")

        elif any(w in query_lower for w in ["document", "docs", "certificate", "paperwork", "proof", "need"]):
            parts.append(f"Hello {student_name}! Here are the required documents for your matched scholarships:\n\n")
            if schemes:
                all_docs = set()
                for s in schemes:
                    for d in s.get("required_documents") or []:
                        all_docs.add(d.replace("_", " ").title())
                if all_docs:
                    for doc in sorted(all_docs):
                        parts.append(f"• **{doc}**\n")
                    parts.append("\nEnsure your certificates (especially Income and Domicile/Caste) are current for the academic year.")
                else:
                    parts.append("Standard documentation includes: Marksheet, Income Certificate, and College Bonafide Certificate.")
            else:
                parts.append("No specific document checklist found; please check your portal profile.")

        elif any(w in query_lower for w in ["deadline", "date", "last date", "when", "closing"]):
            parts.append(f"Hello {student_name}! Here are the application deadlines for your matched scholarships:\n\n")
            if schemes:
                for s in schemes:
                    title = s.get("title") or s.get("scheme_name")
                    dl = s.get("deadline") or "Ongoing"
                    parts.append(f"• **{title}**: Deadline is **{dl}**\n")
            else:
                parts.append("No specific deadlines found in matched list.")

        else:
            parts.append(f"Hello {student_name}! Here is a summary of your matched scholarships:\n\n")
            if schemes:
                parts.append(f"You have **{len(schemes)} matched scholarship(s)** based on your profile:\n\n")
                for idx, s in enumerate(schemes, start=1):
                    title = s.get("title") or s.get("scheme_name")
                    award = s.get("award_amount_inr") or s.get("award_amount")
                    award_str = f"₹{award:,}" if award else "Grant"
                    dl = s.get("deadline") or "Open"
                    parts.append(f"{idx}. **{title}** — Award: {award_str} (Deadline: {dl})\n")
                parts.append("\nFeel free to ask me about required documents, eligibility details, or award amounts!")
            else:
                parts.append("We haven't found any active matched schemes for your profile yet. Please check back after updating your profile facts!")

        full_response = "".join(parts)
        # Yield words in chunks to simulate streaming
        words = full_response.split(" ")
        for i, word in enumerate(words):
            token = word + (" " if i < len(words) - 1 else "")
            yield token
            await asyncio.sleep(0.015)

    @classmethod
    async def generate_chat_stream(
        cls,
        query: str,
        profile_id: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None,
        stream_format: str = "text",
        db: Optional[Session] = None,
    ) -> AsyncGenerator[str, None]:
        """Fetch context from backend routes and stream LangChain chatbot answer."""
        if not query or not query.strip():
            yield "Please enter a valid question or query."
            return

        # 1. Fetch user profile from {BACKEND_URL}/api/profiles/{profileId}
        profile_data: Optional[Dict[str, Any]] = None
        if profile_id:
            profile_data = await cls.fetch_user_profile(profile_id, db=db)

        # 2. Fetch schemes context from {BACKEND_URL}/api/schemes/matched/{profileId}
        matched_schemes: List[Dict[str, Any]] = []
        if profile_id:
            matched_schemes = await cls.fetch_matched_schemes(profile_id, db=db)

        # 3. Construct prompt context
        context_str = cls.format_context_string(profile_data, matched_schemes)

        system_instruction = (
            "You are ScholarPilot AI, an empathetic, highly knowledgeable scholarship advisory assistant for Indian students.\n\n"
            "STUDENT & MATCHED SCHOLARSHIPS CONTEXT:\n"
            f"{context_str}\n\n"
            "INSTRUCTIONS:\n"
            "1. Answer the student's question accurately, concisely, and specifically using the profile and matched schemes context provided.\n"
            "2. Whenever mentioning a scholarship, specify the exact name, award amount, and key deadline if available.\n"
            "3. If the student asks for documents, eligibility requirements, or amounts, strictly cite the verified information in context.\n"
            "4. If information is not in the context, politely clarify that it is not specified in the current scheme details.\n"
            "5. Never invent eligibility criteria, dates, or amounts."
        )

        # Format message history for LangChain
        lc_messages: List[Any] = []
        if history:
            for h in history:
                role = str(h.get("role", "user")).lower()
                content = str(h.get("content", ""))
                if content:
                    if role in ["assistant", "ai"]:
                        lc_messages.append(AIMessage(content=content))
                    elif role == "user":
                        lc_messages.append(HumanMessage(content=content))

        lc_messages.append(HumanMessage(content=query.strip()))

        # Determine which streaming provider to invoke
        gemini_key = os.getenv("GEMINI_API_KEY") or settings.GEMINI_API_KEY
        groq_key = os.getenv("GROQ_API_KEY") or settings.GROQ_API_KEY

        is_sse = stream_format.lower() == "sse"
        yielded_any = False

        # Attempt 1: Gemini (if valid Google AI Studio key format)
        if gemini_key and gemini_key.startswith("AIzaSy"):
            try:
                async for token in cls._stream_gemini_response(
                    system_instruction=system_instruction,
                    messages=lc_messages,
                    api_key=gemini_key,
                    model_name=settings.GEMINI_MODEL,
                ):
                    yielded_any = True
                    if is_sse:
                        yield f"data: {json.dumps({'text': token})}\n\n"
                    else:
                        yield token
                if yielded_any:
                    if is_sse:
                        yield "data: [DONE]\n\n"
                    return
            except Exception as e:
                logger.warning(f"Gemini streaming failed ({e}); falling back to Groq.")

        # Attempt 2: Groq (ultra-fast model streaming)
        if groq_key:
            try:
                async for token in cls._stream_groq_response(
                    system_instruction=system_instruction,
                    history=history or [],
                    query=query.strip(),
                    api_key=groq_key,
                    model_name=settings.GROQ_MODEL,
                ):
                    yielded_any = True
                    if is_sse:
                        yield f"data: {json.dumps({'text': token})}\n\n"
                    else:
                        yield token
                if yielded_any:
                    if is_sse:
                        yield "data: [DONE]\n\n"
                    return
            except Exception as e:
                logger.warning(f"Groq streaming failed ({e}); falling back to deterministic.")

        # Attempt 3: Guaranteed deterministic factual fallback generator
        async for token in cls._stream_deterministic_fallback(
            query=query.strip(),
            profile=profile_data,
            schemes=matched_schemes,
        ):
            if is_sse:
                yield f"data: {json.dumps({'text': token})}\n\n"
            else:
                yield token
        if is_sse:
            yield "data: [DONE]\n\n"
