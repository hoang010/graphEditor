import json
import csv
import pandas as pd
import os
from collections import defaultdict

file_path = os.getcwd().replace("\\", "/")

class Graph():
    def __init__(self):
        """
        self.edges is a dict of all possible next nodes
        e.g. {'X': ['A', 'B', 'C', 'E'], ...}
        self.weights has all the weights between two nodes,
        with the two nodes as a tuple as the key
        e.g. {('X', 'A'): 7, ('X', 'B'): 2, ...}
        """
        self.edges = defaultdict(list)
        self.weights = {}
        self.directions = {}
    
    def add_edge(self, from_node, to_node, direction_,special):
        #add the edge to the graph
        self.edges[from_node].append(to_node)
        #default the cost to go through the edge to be 1
        self.weights[(from_node, to_node)] = 1
        #signify how the edge is crossed
        self.directions[(from_node, to_node)] = direction_
        #if normal then add another edge from opposite direction
        if not special:
            self.edges[to_node].append(from_node)
            self.weights[(to_node, from_node)] = 1
            self.directions[(to_node, from_node)] = -direction_

graph = Graph()

with open("./graph.json") as f: 
    data = json.load(f)
data = data['graph']

edges = []
all_nodes = {}
all_locations = {}
for dat in data:
    if 'edges' in dat.keys():
        #skip over all the nodes
        node = dat['value']
        if dat['id'] in all_nodes:
            print('already exist')
        else:
            all_nodes[dat['id']] = node['text']

        if node['text'] in all_locations:
            print('already exist')
        else:
            all_locations[node['text']] = node['desc']
        continue
    else:
        #only analyze the edges
        curEdge = dat['value']
        #store node id
        edges.append((dat['source'],dat['target'],curEdge['desc'],curEdge['special']))
actual_edges = []

for edge in edges:
    source = edge[0]
    dest = edge[1]
    #add names
    new_edge = (all_nodes[source],all_nodes[dest],edge[2],edge[3])
    actual_edges.append(new_edge)

for edge in actual_edges:
    graph.add_edge(*edge)

#NxM matrix declaration by the size of the number of shop destination
MATRIX_SIZE = len(all_nodes)+1
sample = [[0 for x in range(MATRIX_SIZE)] for y in range(MATRIX_SIZE)] 
i=0
for node in all_nodes:
    if i == 0:
        sample[i][i] = "NULL"
        i+=1
    sample[0][i] = all_nodes[node]
    sample[i][0] = all_nodes[node]
    i +=1

for i in range(MATRIX_SIZE):
    for j in range(MATRIX_SIZE):
        if i == j and i == 0:
            sample[i][j] = "NULL"
            continue
        if i == 0:
            continue
        elif j == 0:
            continue
        #add the name of the source and destination in the the cell for now
        #this is to prevent finding the wrong shop from the wrong floor if the shop is present in multiple floors
        sample[i][j] = "default"

org_df = pd.DataFrame(sample)
org_df.to_csv("{}/cur_intermediate_tables/original.csv".format(file_path))
###################################################### constants ######################################################
UNCLEAR = "unclear"
QUES_TYPE_DELIMITER ="||"
ALREADYTHERE = 'You are already at your destination'
###################################################### utilities methods ######################################################
def gen_unknown_src(dest):
    return "You are going to {}. Which shop or store are you currently at?".format(dest)
    
def gen_unknown_dest(src):
    return "You are currently at {}. Where do you want to go to?".format(src)
def gen_question(src , dest):
    results = []

    src_name = src.strip()#remove any white spaces
    dest_name = dest.strip()
    results.append('SD{}How do I get from {} to {}?'.format(QUES_TYPE_DELIMITER,src_name, dest_name))
    results.append('SD{}Could you tell me the direction to {} from {}?'.format(QUES_TYPE_DELIMITER,dest_name, src_name))
    results.append('SD{}Where is {}? I am at {}'.format(QUES_TYPE_DELIMITER,dest_name, src_name))
    results.append('D{}Where is {}?'.format(QUES_TYPE_DELIMITER,dest_name))
    results.append('D{}How do I go to {}?'.format(QUES_TYPE_DELIMITER,dest_name))
    results.append('S{}I am at {}'.format(QUES_TYPE_DELIMITER,src_name))
    return results
def gen_cell(questions, answer, src,dest, src_loc, dest_loc):
    json_string = ''
    cell = {}
    result_text = ''
    for i in range(len(questions)):
        temp = {}
        try:
            ques_type, ques = questions[i].split(QUES_TYPE_DELIMITER)
            temp['Q'] = ques
        except:
            print(questions[i])

        if ques_type == "SD":
            temp['src'] = src
            temp['dest'] = dest
            temp['src_location'] = src_loc
            temp['dest_location'] = dest_loc
            temp['A'] = answer
        elif ques_type == "D":
            temp['src'] = UNCLEAR
            temp['dest'] = dest
            temp['src_location'] = UNCLEAR
            temp['dest_location'] = dest_loc
            temp['A'] = gen_unknown_src(dest)
        elif ques_type == "S":
            temp['src'] = src
            temp['dest'] = UNCLEAR
            temp['src_location'] = src_loc
            temp['dest_location'] = UNCLEAR
            temp['A'] = gen_unknown_dest(src)
        else:
            print("Unrecognized question type")
        cur_string = json.dumps(temp).replace("\\","")
        cell[('data_'+ str(i))] = temp
    

    result = json.dumps(cell).replace("\\","")
    result_text = result

    return result,result_text,cell
def gen_path(path,src,dest):
    #split the parts into different steps with | char
    parts = path.split('|')
    gen_path = 'at '
    cur_dir = -100
    last_marked = ""
    #loop through all parts
    for i in range(len(parts)):
        #if it is the first part, means it is at the start of the sentence, add the source name
        if i == 0:
            gen_path += src + ' '
        else:
            # split the current part by >
            direction, nxt = parts[i].split('>')
            #remember the destination to be added back later if the direction has not changed
            if cur_dir == direction:
                last_marked = nxt
                continue
            else:
                #if the direction changed and last marked is not empty then add the landmarks
                if last_marked:
                    gen_path += last_marked + ' from there '
            #-1 is turn left
            #0 is go straight
            #1 is turn right
            #-2 is go down an elevator
            #2 is go up an elevator
            #3 or -3 are both go towards something in the line of sight
            if direction == '1':
                gen_path += "turn right and go until you see "
            elif direction == '-1':
                gen_path += "turn left and go until you see "
            elif direction == '0':
                gen_path += "go straight until you see "
            elif direction == '2':
                gen_path += "go up the elevator until "
            elif direction == '-2':
                gen_path += "go down the elevator until "
            elif direction == '3' or direction == '-3':
                gen_path += "you will see "
            last_marked = nxt
            cur_dir = direction
    gen_path += dest
    return gen_path
#dijkstra algorithm to find the shortest path based on the map
def find_path(graph, initial, end):
    # shortest paths is a dict of nodes
    # whose value is a tuple of (previous node, weight)
    shortest_paths = {initial: (None, 0)}
    current_node = initial
    visited = set()
    
    while current_node != end:
        visited.add(current_node)
        destinations = graph.edges[current_node]
        weight_to_current_node = shortest_paths[current_node][1]

        for next_node in destinations:
            weight = graph.weights[(current_node, next_node)] + weight_to_current_node
            if next_node not in shortest_paths:
                shortest_paths[next_node] = (current_node, weight)
            else:
                current_shortest_weight = shortest_paths[next_node][1]
                if current_shortest_weight > weight:
                    shortest_paths[next_node] = (current_node, weight)
        
        next_destinations = {node: shortest_paths[node] for node in shortest_paths if node not in visited}
        if not next_destinations:
            return "Route Not Possible"
        # next node is the destination with the lowest weight
        current_node = min(next_destinations, key=lambda k: next_destinations[k][1])
    
    # Work back through destinations in shortest path
    path = []
    while current_node is not None:
        path.append(current_node)
        next_node = shortest_paths[current_node][0]
        current_node = next_node
    # Reverse path
    path = path[::-1]
    real_path = ''
    for i in range(len(path)):
        if i == 0:
            real_path += str(path[i])
        else:
            real_path += "|"+str(graph.directions[(path[i-1],path[i])])+">"+str(path[i])
    return real_path
###################################################### main ######################################################
counter = 0
all_result = {}
error = 0
#index start from 1 to skip the name rows and columns
for i in range(1,MATRIX_SIZE):
    #checking for the progress every 20 shops
    if (i%20 == 1 ):
        print("Generating directions for shop number {} out of {} shops".format(str(i), str(MATRIX_SIZE - 1)))
    for j in range(1,MATRIX_SIZE):
        src = sample[0][i]
        dest = sample[j][0]
        src_loc = all_locations[src]
        dest_loc = all_locations[dest]

        assert error == 0

        questions = gen_question(src, dest)
        assert len(questions) > 1
        #if the src and the dest is the same then add a default cell
        if src == dest:
            temp_path = ALREADYTHERE
            cell_content, text,cell_dir = gen_cell(questions, temp_path,src,dest, src_loc,dest_loc)
            all_result[counter] = cell_dir
            sample[i][j] = cell_content
            counter += 1
            continue
        
        #use the graph to find the fastest path
        path = find_path(graph, src, dest)
        #from the path generate the words
        answer = gen_path(path, src, dest)
        #generate the data in 2 places, one is in the cell, the other is the json file
        cell_content,text,cell_dir = gen_cell(questions, answer, src, dest, src_loc,dest_loc)
        
        all_result[counter] = cell_dir

        if path !=  "Route Not Possible":
            sample[i][j] = cell_content
        else:
            sample[i][j] = path
        counter += 1
    
df = pd.DataFrame(sample)
df.to_csv("{}/result/matrix.csv".format(file_path))
with open('{}/result/data.json'.format(file_path), 'w') as js:
    json.dump(all_result,js, indent=3,ensure_ascii=True)
print("Done generating samples...")

print("Edited {} entries of out {} possible entries".format(counter,(MATRIX_SIZE-1)*(MATRIX_SIZE-1)))