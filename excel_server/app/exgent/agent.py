from textwrap import dedent
from typing import Any, Optional

from app.domain import SheetStructure
from app.exgent.agent_utils import (
    CustomLiteLlm,
)
from app.exgent.tag_groups_agent import tag_all_groups_agent
from app.exgent.validate_sheet_structure_agent import ValidateSheetStructureAgent
from google.adk.agents.llm_agent import LlmAgent
from google.adk.agents.sequential_agent import SequentialAgent
from pydantic import BaseModel

EXCEL_FILE_DATA = "excel_file_data"

SHEET_STRUCTURE_PROMPT = dedent("""
**Role:** You are an expert financial analyst.

**Task:** You will receive CSV-formatted data representing a client's financial statement. Your goal is to analyze this data *without writing any code* to understand its structure.

**Instructions:**

1.  **Identify Statement Type:** First, examine the data to determine the type of financial statement (e.g., Balance Sheet, Income Statement, Cash Flow Statement).
2.  **Identify Financial Items Column:** Identify the column that contains the financial items.
3.  **Identify Date Columns:** Identify the columns that contain the dates.
2.  **Analyze and Classify Rows:** As you read the data, classify each row into one of three categories:
      * **Header:** A row that acts as a title or section heading, typically without numerical values (e.g., `Assets`, `Current Liabilities`).
      * **Line Item:** A row representing a specific account, which typically has a corresponding numerical value (e.g., `Cash and Cash Equivalents`, `Accounts Payable`).
      * **Total:** A row that represents a subtotal or grand total, summing the line items above it (e.g., `Total Current Assets`, `Total Liabilities`).
3.  **Identify Groups:** Your main objective is to identify all logical groupings. A "group" consists of an optional **Header** row and one or more **Line Item** rows that are summed together to create a single **Total** row.

Important: You must complete all the steps above before generating your output.
-----

**Output Format:**
Your response should be human readable **markdown:: format.
Respond to the user that your task is to **Identify the structure of the excel file**. Then,
1. Clearly state the statement type
2. Then state the financial items column and date columns. You must output the column index. Index starts at 1.
3. Then proceed to ouput the groups in the following format:
    * Group Name: A descriptive name from the group
    * Header Rows: List of comma separated row numbers representing the header rows in the group
    * Line Items: List of comma separated row numbers representing the items in the group
    * Total Row: Row number and description associated with the total row.
    * Make sure you output all the groups you have identified.

Important: do not include any other text or explanation in your response.
If you notice you have already performed the task, varify your work and output a fresh response.
-----

**Data for Analysis:**

{excel_file_data}
""")

STRUCTUED_RESPONSE_PROMPT = dedent("""
Extract data from the input below

Input Text:
'''
{sheet_structure_human_readable}
'''
""")


class UIResponse(BaseModel):
    task_name: str
    data: Optional[dict[str, Any] | list[Any]] = None
    user_confirmation: Optional[bool] = None


generate_agent = LlmAgent(
    name="excel_tag_generate_agent",
    model=CustomLiteLlm(
        model="gemini/gemini-2.5-pro",
        stream=True,
    ),
    instruction=SHEET_STRUCTURE_PROMPT,
    output_key="sheet_structure_human_readable",
    include_contents="none",
)


# def validate_sheet_structure_and_save(
#     callback_context: CallbackContext, llm_response: LlmResponse
# ) -> Optional[LlmResponse]:
#     if llm_response.partial is False:
#         sheet_info_store: SheetInfoStore = get_custom_metadata(
#             callback_context._invocation_context, "sheet_info_store"
#         )
#         file_id: str = get_custom_metadata(
#             callback_context._invocation_context, "file_id"
#         )
#         sheet_idx: int = get_custom_metadata(
#             callback_context._invocation_context, "sheet_idx"
#         )
#         sheet_name: str = get_custom_metadata(
#             callback_context._invocation_context, "sheet_name"
#         )

#         session_state = get_session_state(callback_context._invocation_context)

#         text_response = get_text_content(llm_response)
#         if text_response is not None:
#             sheet_structure = SheetStructure.model_validate_json(text_response)
#             sheet_info_payload = SheetInfoPayload(
#                 structure=sheet_structure,
#                 tags=[],
#             )

#             session_state["sheet_structure_json"] = text_response

#             sheet_info_store.add_sheet_info(
#                 user_id="excel_tag_structured_agent",
#                 file_id=file_id,
#                 sheet_idx=sheet_idx,
#                 sheet_name=sheet_name,
#                 payload=sheet_info_payload,
#             )
#             return None


structured_response_agent = LlmAgent(
    name="excel_tag_structured_agent",
    model=CustomLiteLlm(
        model="gemini/gemini-2.5-flash",
        stream=False,
    ),
    include_contents="none",
    instruction=STRUCTUED_RESPONSE_PROMPT,
    output_schema=SheetStructure,
    output_key="sheet_structure_json",
)

validate_sheet_structure_agent = ValidateSheetStructureAgent(
    input_key="sheet_structure_json"
)


# Agent 2: The specialist for general questions
qa_agent = LlmAgent(
    name="QaAgent",
    model=CustomLiteLlm(
        model="gemini/gemini-2.0-flash",
        stream=True,
    ),
    description="Use this agent for general questions, FAQs, or information lookups.",
    instruction="""
    You are a helpful assistant. Use the provided knowledge base to answer user queries.
    If the question does not pertain to the excel sheet, you should politely decline to answer.
    If the question is not clear, you should ask the user to clarify.

    Data for analysis:
    {excel_file_data}
    """,
)

excel_tag_agent = SequentialAgent(
    name="excel_tag_agent",
    description="Use this agent for tagging tasks.",
    sub_agents=[
        generate_agent,
        structured_response_agent,
        validate_sheet_structure_agent,
        tag_all_groups_agent,
    ],
)

router_agent = LlmAgent(
    name="RouterAgent",
    model=CustomLiteLlm(
        model="gemini/gemini-2.0-flash",
        stream=True,
    ),
    instruction="""
    You are a router agent. You are responsible for routing the user's request to the correct agent.
    Analyze the user's request:
    1. If the user wants to perform tagging tasks, delegate to excel_tag_agent.
    2. If the user asks a general question about the excel file or needs information, delegate to qa_agent.
    3. Do not attempt to answer yourself; always route to the correct specialist.
    """,
    sub_agents=[excel_tag_agent, qa_agent],
)
