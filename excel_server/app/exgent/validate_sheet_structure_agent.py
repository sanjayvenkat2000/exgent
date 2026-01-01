import io
from typing import AsyncGenerator

import pandas as pd
from app.domain import ReportGroupValidationResult, SheetInfoPayload, SheetStructure
from app.exgent.agent_utils import get_custom_metadata
from app.sheet_info_store.sheet_info_store import SheetInfoStore
from google.adk.agents.invocation_context import InvocationContext
from google.adk.agents.llm_agent import LlmAgent
from google.adk.events.event import Event
from google.genai.types import CodeExecutionResult, Content, Outcome, Part


class ValidateSheetStructureAgent(LlmAgent):
    input_key: str

    def __init__(self, input_key: str):
        super().__init__(name="tag_ontology_agent", input_key=input_key)  # pyright: ignore[reportCallIssue]

    def _parse_value(self, value) -> float:
        if pd.isna(value) or value == "":
            return 0.0
        s = str(value).strip()
        if not s:
            return 0.0
        # Handle negative numbers in parentheses
        if "(" in s and ")" in s:
            s = "-" + s.replace("(", "").replace(")", "")
        # Remove currency symbols and commas
        s = s.replace("$", "").replace(",", "").replace(" ", "")
        try:
            return float(s)
        except ValueError:
            return 0.0

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

        validation_results: list[ReportGroupValidationResult] = []

        for group in sheet_structure.groups:
            # Validate row groups and check totals
            for date_col in date_columns:
                calculated_total = 0.0
                # Sum the line items
                for line_item_row in group.line_items:
                    if 0 <= line_item_row < len(df):
                        val = self._parse_value(df.iloc[line_item_row, date_col])
                        calculated_total += val

                # Get the actual total
                actual_total = 0.0
                if 0 <= group.total < len(df):
                    actual_total = self._parse_value(df.iloc[group.total, date_col])

                # Check if they match (with tolerance)
                matches = abs(calculated_total - actual_total) < 0.01

                group_result = ReportGroupValidationResult(
                    group_name=group.name,
                    date_column=date_col,
                    calculated_total=calculated_total,
                    actual_total=actual_total,
                    matches=matches,
                )

                validation_results.append(group_result)

        # Keep track of results in session state
        sheet_info_store: SheetInfoStore = get_custom_metadata(ctx, "sheet_info_store")
        file_id: str = get_custom_metadata(ctx, "file_id")
        sheet_idx: int = get_custom_metadata(ctx, "sheet_idx")
        sheet_name: str = get_custom_metadata(ctx, "sheet_name")

        sheet_structure.validation_results = validation_results
        sheet_info_payload = SheetInfoPayload(
            structure=sheet_structure,
            tags=[],
        )

        sheet_info_store.add_sheet_info(
            user_id="excel_tag_structured_agent",
            file_id=file_id,
            sheet_idx=sheet_idx,
            sheet_name=sheet_name,
            payload=sheet_info_payload,
        )

        event = Event(
            author="tag_ontology_agent",
            content=Content(
                parts=[
                    Part(text="Validation results saved"),
                    Part(
                        code_execution_result=CodeExecutionResult(
                            output="UI update required. New sheet information is available.",
                            outcome=Outcome.OUTCOME_OK,
                        )
                    ),
                ],
                role="assistant",
            ),
        )
        yield event
