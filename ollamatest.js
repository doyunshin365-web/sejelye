import ollama from 'ollama';

const message = { role: 'user', content: 'Why is the sky blue?' };

const response = await ollama.chat({
  model: 'gpt-oss:20b',
  messages: [message],
  stream: true,
});

for await (const part of response) {
  // process.stdout.write를 쓰면 줄바꿈 없이 붙어서 출력돼! 📝
  if (part.message?.content) {
    process.stdout.write(part.message.content);
  }
}