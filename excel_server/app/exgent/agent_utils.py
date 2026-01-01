from typing import Any, AsyncGenerator, Optional

from google.adk.agents.invocation_context import InvocationContext
from google.adk.models.lite_llm import LiteLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse


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


def get_session_state(
    invocation_context: InvocationContext,
) -> dict[str, Any]:
    return invocation_context.session.state or {}


def get_text_content(llm_response: LlmResponse) -> Optional[str]:
    if llm_response.content is None:
        raise ValueError("Content is not set. We need a content from the model")
    for part in (
        llm_response.content.parts if llm_response.content.parts is not None else []
    ):
        if part.text is not None:
            return part.text
    return None


def get_custom_metadata(
    invocation_context: InvocationContext,
    key: str,
) -> Any:
    """Safely retrieves a value from custom_metadata in the run_config."""
    run_config = invocation_context.run_config
    if not run_config or not run_config.custom_metadata:
        raise ValueError(f"Missing configuration or metadata to retrieve '{key}'")

    value = run_config.custom_metadata.get(key)
    if value is None:
        raise ValueError(f"Required metadata '{key}' is missing")

    return value
