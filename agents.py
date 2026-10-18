# import os
# import re
# from langchain_groq import ChatGroq
# from schemas import Classification


# def llm():
#     return ChatGroq(model=os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile'), temperature=0)


# def classify(message: str) -> dict:
#     result = llm().with_structured_output(Classification).invoke([
#         ('system', 'Classify the customer support request. Extract an order ID like ORD-1001 if present. Never invent an ID.'),
#         ('human', message),
#     ])
#     # Deterministic regex avoids losing an explicit ID to model formatting.
#     match = re.search(r'\bORD-\d+\b', message, re.IGNORECASE)
#     return {'intent': result.intent, 'order_id': match.group(0).upper() if match else result.order_id}


# def compose_reply(message: str, outcome: str, detail: str) -> str:
#     response = llm().invoke([
#         ('system', 'Write a concise, courteous customer service reply. The outcome and detail are authoritative. Never say a payment was sent or money returned when only a demo ledger was updated. Never override the decision.'),
#         ('human', f'Customer: {message}\nOutcome: {outcome}\nDetail: {detail}'),
#     ])
#     return response.content if isinstance(response.content, str) else str(response.content)

import os
import re
from langchain_groq import ChatGroq
from schemas import Classification

def llm():
    return ChatGroq(model=os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile'), temperature=0)

def classify(message: str) -> dict:
    try:
        # json_mode is required for Groq to work reliably
        model = llm().with_structured_output(Classification, method="json_mode")
        result = model.invoke([
            ('system', 'Classify the customer support request. Extract an order ID like ORD-1001 if present. Never invent an ID. Return JSON with intent and order_id.'),
            ('human', message),
        ])
        match = re.search(r'\bORD-\d+\b', message, re.IGNORECASE)
        return {'intent': result.intent, 'order_id': match.group(0).upper() if match else result.order_id}
    except Exception as e:
        print(f"Structured output failed, using fallback: {e}")
        m = re.search(r'\bORD-\d+\b', message, re.IGNORECASE)
        order_id = m.group(0).upper() if m else None
        lower = message.lower()
        if 'refund' in lower:
            intent = 'refund'
        elif 'track' in lower or 'where' in lower or 'status' in lower:
            intent = 'tracking'
        elif 'cancel' in lower:
            intent = 'cancellation'
        elif 'complaint' in lower or 'human' in lower or 'agent' in lower:
            intent = 'complaint'
        else:
            intent = 'general'
        return {'intent': intent, 'order_id': order_id}
# def compose_reply(message: str, outcome: str, detail: str) -> str:
#     # If it's tracking / information_only, don't ask for email, just give detail
#     if "information_only" in outcome or "status" in detail.lower():
#         return f"Here is your order info: {detail}. Let me know if you need anything else!"
    
#     response = llm().invoke([
#         ('system', 'Write a concise, courteous customer service reply. The outcome and detail are authoritative. Never say a payment was sent or money returned when only a demo ledger was updated. Never override the decision.'),
#         ('human', f'Customer: {message}\nOutcome: {outcome}\nDetail: {detail}'),
#     ])
#     return response.content if isinstance(response.content, str) else str(response.content)
# # def compose_reply(message: str, outcome: str, detail: str) -> str:
# #     response = llm().invoke([
# #         ('system', 'Write a concise, courteous customer service reply. The outcome and detail are authoritative. Never say a payment was sent or money returned when only a demo ledger was updated. Never override the decision.'),
# #         ('human', f'Customer: {message}\nOutcome: {outcome}\nDetail: {detail}'),
# #     ])
# #     return response.content if isinstance(response.content, str) else str(response.content)
def compose_reply(message: str, outcome: str, detail: str) -> str:
    # For tracking/cancellation/complaint - just return the detail directly, don't let LLM hallucinate
    if outcome == 'information_only':
        return detail + " Let me know if you need anything else!"
    
    # Only for refunds use LLM
    response = llm().invoke([
        ('system', 'Write a concise, courteous customer service reply. The outcome and detail are authoritative. Never say a payment was sent or money returned when only a demo ledger was updated.'),
        ('human', f'Customer: {message}\nOutcome: {outcome}\nDetail: {detail}'),
    ])
    return response.content