from textwrap import dedent
from typing import Any, AsyncGenerator, Optional

from google.adk.agents.llm_agent import LlmAgent
from google.adk.agents.sequential_agent import SequentialAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from pydantic import BaseModel


class CustomLiteLlm(LiteLlm):
    force_stream: Optional[bool] = None

    def __init__(self, model: str, stream: Optional[bool] = None, **kwargs):
        super().__init__(model=model, **kwargs)
        self.force_stream = stream

    async def generate_content_async(
        self, llm_request: LlmRequest, stream: bool = False
    ) -> AsyncGenerator[LlmResponse, None]:
        if self.force_stream is not None:
            stream = self.force_stream

        async for response in super().generate_content_async(
            llm_request, stream=stream
        ):
            yield response


class ReportGroup(BaseModel):
    name: str
    header_rows: list[int]
    line_items: list[int]
    total: int


class SheetStructure(BaseModel):
    statement_type: str
    financial_items_column: int
    date_columns: list[int]
    groups: list[ReportGroup]


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
1. Clearly state the statement type
2. Then state the financial items column and date columns. You must output the column index. 
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
)


structured_response_agent = LlmAgent(
    name="excel_tag_structured_agent",
    model=CustomLiteLlm(
        model="gemini/gemini-2.5-flash",
        stream=False,
    ),
    include_contents="none",
    instruction=STRUCTUED_RESPONSE_PROMPT,
    output_key="sheet_structure_json",
    output_schema=SheetStructure,
)


excel_tag_agent = SequentialAgent(
    name="excel_tag_agent",
    sub_agents=[generate_agent, structured_response_agent],
)
