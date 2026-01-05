# Excel Server

A professional FastAPI-based backend designed for advanced Excel file processing, structural analysis, and AI-powered interactions.

## Features

- **Excel Processing**: Seamlessly converts Excel workbooks and sheets into structured JSON data.
- **AI-Powered Analysis**: Utilizes Google ADK (Agent Development Kit) and Gemini models to automatically identify sheet structures (headers, line items, totals) and perform tagging.
- **Streaming Chat**: Real-time streaming interface for querying financial data within Excel sheets using specialized AI agents.
- **Robust Storage**: Local file management and SQLite-based tracking for files, sheet metadata, and chat sessions.
- **Scalable Architecture**: Built with FastAPI, Pydantic, and SQLAlchemy for performance and type safety.

## Prerequisites

- **Python**: 3.12 or higher.
- **uv**: A high-performance Python package installer and resolver.

## Installation

### 1. Install `uv`

If you haven't installed `uv` yet, you can do so using the following command:

**macOS/Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Windows:**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### 2. Initialize the Project

Clone the repository and navigate to the `excel_server` directory. Then, synchronize the environment and install dependencies:

```bash
cd excel_server
uv sync
```

This command will create a virtual environment and install all required dependencies listed in `pyproject.toml`.

## Configuration

The server requires a `.env` file for configuration. Create a file named `.env` in the `excel_server` root:

```env
base_storage_dir=/path/to/your/storage  # Directory where files and DBs will be stored
GOOGLE_API_KEY=your_gemini_api_key      # Required for AI agent functionality
```

## Running the Server

You can start the server using `uv`:

```bash
uv run python -m app
```

By default, the server will be available at `http://0.0.0.0:8080`.

### API Documentation

Once the server is running, you can access the interactive API documentation at:
- **Swagger UI**: [http://localhost:8080/docs](http://localhost:8080/docs)

## Testing

To run the test suite, use the following command:

```bash
uv run pytest
```

## Project Structure

- `app/server/server.py`: Main FastAPI application and routing logic.
- `app/exgent/`: AI agent definitions and utilities.
- `app/file_store/`: Local file storage implementation.
- `app/sheet_info_store/`: SQLite-based metadata storage for sheet structures.
- `app/domain.py`: Pydantic models and core domain logic.

