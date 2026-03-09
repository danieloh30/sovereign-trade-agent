# Sovereign Trade Agent

An AI-powered trade compliance assistant for the London market that uses local LLMs to verify transactions against FCA anti-money laundering (AML) rules.

## Running the application in dev mode

Quarkus Dev Services will automatically start Ollama and OpenTelemetry containers:

```shell script
./mvnw quarkus:dev
```

> **_NOTE:_** Quarkus Dev UI is available at <http://localhost:8080/q/dev/>

## Demo Scenario

### Test the AML Check Tool

Send a transaction query that exceeds the £10,000 threshold:

**Using curl:**
```bash
curl -X POST http://localhost:8080/trade/analyze \
  -H "Content-Type: text/plain" \
  -d "I have a customer, 'London Tech Ltd', trying to move £12,500 to a new vendor in Estonia for 'Cloud Services'. Before I approve this, check our local AML rules."
```

**Expected Response:**
```
REJECTED: Manual FCA review required for amounts over £10k.
```

**Using Dev UI:**
1. Navigate to <http://localhost:8080/q/dev/>
2. Find the REST endpoint `/trade/analyze`
3. Paste the query above
4. Submit

### Test Cases

| Amount | Currency | Expected Result |
|--------|----------|----------------|
| £12,500 | GBP | REJECTED (>£10k) |
| £8,000 | GBP | CLEARED (≤£10k) |
| €15,000 | EUR | CLEARED (not GBP) |

## How It Works

1. **AI Agent** extracts transaction amount and currency from natural language
2. **Tool Invocation** calls `checkAMLStatus(amount, currency)`
3. **Local Regulatory Database** verifies against FCA rules (>£10k GBP requires review)
4. **Response** returns compliance status

### Architecture

```
User Query → AI Agent → Tool Call → Local Regulatory Database → Compliance Result
                ↓
         (Ollama LLM)              (TradeTools.checkAMLStatus)
```

**Key Components:**
- **Local LLM (Ollama)**: Processes natural language queries without sending data to external APIs
- **Local Regulatory Database**: FCA AML rules stored and processed locally for data sovereignty
- **OpenTelemetry**: Observability for monitoring agent behavior and tool invocations

## Configuration

Edit `src/main/resources/application.properties`:

```properties
# LLM Model (must support tool calling)
quarkus.langchain4j.ollama.chat-model.model-id=llama3.2

# Ollama endpoint
quarkus.langchain4j.ollama.base-url=http://localhost:11434

# OpenTelemetry (optional)
quarkus.otel.exporter.otlp.endpoint=http://localhost:4317
```

## Learn More

- [Quarkus](https://quarkus.io/)
- [Quarkus LangChain4j](https://docs.quarkiverse.io/quarkus-langchain4j/dev/)
- [Ollama](https://ollama.ai/)
