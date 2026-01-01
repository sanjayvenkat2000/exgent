import io
from typing import AsyncGenerator

import pandas as pd
from app.domain import SheetStructure, SheetTag
from app.exgent.agent_utils import CustomLiteLlm, get_custom_metadata, get_text_content
from app.exgent.tag_groups_utils import generate_group_csv
from app.sheet_info_store.sheet_info_store import SheetInfoStore
from google.adk.agents.base_agent import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.agents.llm_agent import LlmAgent
from google.adk.events.event import Event
from google.genai.types import CodeExecutionResult, Content, Outcome, Part

TAG_REPORT_GROUP_PROMPT = """
## 🎯 Role and Goal
You are an expert financial analyst. Your task is to receive a snippet of a financial statement and map **each individual line** to the single best-matching concept from the company's internal ontology.

## 📚 Internal Ontology
You must use **only** the tags from the lists below.

### Cash Flow Statement Concepts
  * Operating Cash Flow (Net cash generated from core operations)
  * Investing Cash Flow (Cash used for long-term investments)
  * Financing Cash Flow (Cash used for debt or equity)
  * Net Cash Flow (Sum of operating, investing, and financing cash flows)


### Income Statement Concepts
  * **Gross Bookings**  (Total value of all contracts signed)
  * **Adjusted Net Revenue** (Actual cash-in after adjustments)
  * **Cost of Goods Sold** (COGS) (Server costs, hosting, third-party APIs)
  * **Operating Income** (Gross Bookings - Cost of Goods Sold)

### Balance Sheet Concepts
  * **Cash and bank balances** : Highly liquid assets held in checking, savings, or money market accounts that are immediately available for use.
  * **Accounts payable** : Short-term obligations owed to suppliers or vendors for goods or services purchased on credit.
  * **Accounts receivable** : Money owed to the company by customers for products or services delivered but not yet paid for.
  * **Inventory** : The value of raw materials, work-in-progress, and finished goods held by the business for eventual sale.
  * **Property, Plant, & Equipment (PP&E)** : Tangible, long-term physical assets used in business operations, such as machinery, buildings, and vehicles.
  * **Accumulated Depreciation & Amortization** : A contra-asset account that tracks the total reduction in value of fixed and intangible assets over their useful life.
  * **Other Long-Term Assets** : Non-current assets that do not fall under PP&E, such as long-term investments, deferred tax assets, or security deposits.
  * **Credit Cards** : Short-term revolving debt used for operational expenses, typically classified as a current liability.
  * **Total Current Assets** : The sum of all assets expected to be converted into cash, sold, or consumed within one fiscal year.
  * **Total Current Liabilities** : The sum of all debts and obligations due to be paid within one fiscal year.
  * **Total Long-Term Assets** : The aggregate value of all assets not expected to be liquidated within the next 12 months.
  * **Total Long-Term Liabilities** : Financial obligations, such as loans or bonds, with a maturity date extending beyond one year.
  * **Total Equity** : The residual interest in the company's assets after subtracting all liabilities; essentially, the "book value" belonging to shareholders.
  * **Total Assets** : The combined value of everything the company owns (Current Assets + Long-Term Assets).
  * **Total Liabilities** : The combined value of everything the company owes to external parties (Current Liabilities + Long-Term Liabilities).

## ⚙️ Instructions & Rules

1.  **Analyze Each Line:** You will be given a block of text. Process every single line provided (e.g., `Row:`, `Item:`, `Total:`, and context lines like `Verifying group:`).
2.  **Assign Best Tag:** Match each line to the *single best tag* from the **Internal Ontology**.
3.  **Use Context:** Use contextual clues (like `Verifying group: Total Revenue`) and your financial expertise to understand the items.
      * For example, specific sales lines (e.g., 'X Men Sales CA', 'Software') map to **Gross Revenue**.
      * Lines for 'Sales Discounts' map to **Total Discounts**.
      * Lines for 'Refunds' or 'Allowances' map to **Total Cancellation and Returns**.
      * A final 'Total Revenue' line that is calculated *after* discounts and returns should be mapped to **Net Revenue**.
4.  Skip tagging header rows. Just tag the item rows and total rows. The header row should not be part of the output and is provided for context only.
5.  If a tag is unclear, tag it as `Unclear`.

-----

## 📤 Output Format

You must provide *only* the mapping. Do not add any extra conversation or explanations.

The output must contain the original line number followed by a comma (`,`) and the assigned tag.

**Example Format:**

```
[Line number from input],[Assigned Tag]
[Line number from input],[Assigned Tag]
[Line number from input],[Unclear]
```

-----

**User Input:**
{report_group_data}

"""


tag_report_group_agent = LlmAgent(
    name="tag_report_group_agent",
    model=CustomLiteLlm(
        model="gemini/gemini-2.5-pro",
        stream=False,
    ),
    instruction=TAG_REPORT_GROUP_PROMPT,
    output_key="report_group_results",
)


class TagAllGroupsAgent(BaseAgent):
    input_key: str

    def __init__(self, input_key: str):
        super().__init__(name="tag_all_groups_agent", input_key=input_key)  # pyright: ignore[reportCallIssue]

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        sheet_structure = SheetStructure.model_validate(
            ctx.session.state[self.input_key]
        )

        csv_data = ctx.session.state["excel_file_data"]
        if csv_data is None:
            raise ValueError("Excel file data is not set for key: excel_file_data")

        df = pd.read_csv(io.StringIO(csv_data), header=None)
        items_column = sheet_structure.financial_items_column
        date_columns = sheet_structure.date_columns

        sheet_tags: list[SheetTag] = []
        for group in sheet_structure.groups:
            group_csv = generate_group_csv(group, df, items_column, date_columns)
            ctx.session.state["report_group_data"] = group_csv

            async for event in tag_report_group_agent.run_async(ctx):
                if not event.partial:
                    results = get_text_content(event)
                    for row in results.split("\n") if results is not None else []:
                        row_number, tag = row.split(",")
                        sheet_tags.append(SheetTag(row=int(row_number), tag=tag))

            sheet_info_store: SheetInfoStore = get_custom_metadata(
                ctx, "sheet_info_store"
            )
            file_id: str = get_custom_metadata(ctx, "file_id")
            sheet_idx: int = get_custom_metadata(ctx, "sheet_idx")
            sheet_name: str = get_custom_metadata(ctx, "sheet_name")

            latest_sheet_info = sheet_info_store.get_latest(
                "tag_all_groups_agent", file_id, sheet_idx
            )

            if latest_sheet_info is not None and latest_sheet_info.payload is not None:
                latest_sheet_info.payload.tags = sheet_tags
                sheet_info_store.add_sheet_info(
                    "tag_all_groups_agent",
                    file_id,
                    sheet_idx,
                    sheet_name,
                    latest_sheet_info.payload,
                )

                yield Event(
                    author="tag_all_groups_agent",
                    content=Content(
                        parts=[
                            Part(
                                code_execution_result=CodeExecutionResult(
                                    output="UI update required. New Sheet Info results are available.",
                                    outcome=Outcome.OUTCOME_OK,
                                )
                            ),
                        ],
                        role="assistant",
                    ),
                )


tag_all_groups_agent = TagAllGroupsAgent(input_key="sheet_structure_json")
