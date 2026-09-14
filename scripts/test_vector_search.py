import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import chromadb
from sentence_transformers import SentenceTransformer

DB_PATH = "./outputs/chroma_db_v2"
model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
client = chromadb.PersistentClient(path=DB_PATH)
coll = client.get_collection("hotels")

queries = [
    "Красная Поляна отель с собакой и теплым бассейном у подъемника",
    "Сочи отель на первой линии у моря с хорошим рейтингом",
    "Санкт-Петербург уютный отель в центре с завтраком",
    "Шерегеш шале рядом с трассой и сауной",
    "Байкал гостиница на берегу с видом на озеро",
]

print(f"Chroma collection count: {coll.count()}")
print("="*60)

for q in queries:
    emb = model.encode([q]).tolist()
    res = coll.query(query_embeddings=emb, n_results=4, include=["metadatas", "documents", "distances"])
    print(f"\nQUERY: '{q}'")
    ids = res["ids"][0]
    distances = res["distances"][0]
    metas = res["metadatas"][0]
    for i in range(len(ids)):
        dist = distances[i]
        sim = 1.0 - dist
        meta = metas[i]
        print(f"  {i+1}. [{meta['city']}] {meta['name']} | stars={meta['stars']} | rating={meta['rating']} | dist={dist:.4f} | sim={sim:.4f}")
