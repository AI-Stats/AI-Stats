import { phaseo } from '../src/index.js';
import { rerank } from 'ai';

const result = await rerank({
  model: phaseo.rerankingModel('cohere/rerank-v4.0-fast'),
  query: 'Which document best explains TypeScript?',
  documents: [
    'TypeScript adds static types to JavaScript.',
    'Rust is a systems programming language.',
  ],
  topN: 1,
});

console.log(result.ranking);
