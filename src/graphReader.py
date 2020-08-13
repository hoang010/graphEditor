import json
with open("./graph.json") as f: 
    data = json.load(f)
data = data['graph']
print()
edges = []
for dat in data:
    if 'edges' in dat.keys():
        #skip over all the nodes
        continue
    else:
        #only analyze the edges
        curEdge = dat['value']
        edges.append((curEdge['src'],curEdge['dest'],curEdge['desc'],curEdge['special']))

print(edges)

