export type SnippetLang = "openai" | "langchain" | "java" | "rust" | "curl";

export const SNIPPET_TABS: readonly { id: SnippetLang; label: string }[] = [
  { id: "openai", label: "Python" },
  { id: "langchain", label: "LangChain" },
  { id: "java", label: "Java" },
  { id: "rust", label: "Rust" },
  { id: "curl", label: "curl" },
];

/** A minimal working client for the local API, per language. */
export function buildSnippet(lang: SnippetLang, apiBase: string, apiKey: string, modelId: string): string {
  switch (lang) {
    case "openai":
      return `# pip install openai
from openai import OpenAI

client = OpenAI(
    base_url="${apiBase}",
    api_key="${apiKey}",
)

response = client.chat.completions.create(
    model="${modelId}",
    messages=[
        {"role": "user", "content": "Hello! Introduce yourself in one sentence."},
    ],
)
print(response.choices[0].message.content)`;
    case "langchain":
      return `# pip install langchain-openai
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="${apiBase}",
    api_key="${apiKey}",
    model="${modelId}",
)

response = llm.invoke("Hello! Introduce yourself in one sentence.")
print(response.content)`;
    case "java":
      return `// Maven: dev.langchain4j:langchain4j-open-ai
// Spring Boot: dev.langchain4j:langchain4j-open-ai-spring-boot-starter
// and in application.properties:
//   langchain4j.open-ai.chat-model.base-url=${apiBase}
//   langchain4j.open-ai.chat-model.api-key=${apiKey}
//   langchain4j.open-ai.chat-model.model-name=${modelId}
// then inject ChatModel where you need it. Plain Java:

import dev.langchain4j.model.openai.OpenAiChatModel;

OpenAiChatModel model = OpenAiChatModel.builder()
        .baseUrl("${apiBase}")
        .apiKey("${apiKey}")
        .modelName("${modelId}")
        .build();

String reply = model.chat("Hello! Introduce yourself in one sentence.");
System.out.println(reply);`;
    case "rust":
      return `// cargo add rig-core tokio --features tokio/macros
use rig::prelude::*;
use rig::providers::openai;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = openai::Client::from_url("${apiKey}", "${apiBase}");
    let agent = client.agent("${modelId}").build();

    let reply = agent
        .prompt("Hello! Introduce yourself in one sentence.")
        .await?;
    println!("{reply}");
    Ok(())
}`;
    case "curl":
      return `curl ${apiBase}/chat/completions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelId}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;
  }
}
