import React, { Component } from "react";
import ReactDOM from "react-dom";
import 'antd/dist/antd.css';
import "./common.css";
import "./mxgraph.css";
import jsonGraph from './graph.json';

import {
  mxGraph,
  mxConstants,
  mxEdgeStyle,
  mxGraphHandler,
  mxGuide,
  mxEdgeHandler,
  mxRubberband,
  mxKeyHandler,
  mxCodec,
  mxClient,
  mxConnectionHandler,
  mxUtils,
  mxEvent,
  mxImage,
  mxConstraintHandler,
  mxUndoManager,
  mxObjectCodec,
  mxConnectionConstraint,
  mxCellState,
  mxPoint,
  mxPerimeter,
  mxCompactTreeLayout,
  mxCellOverlay,
  mxGraphModel
} from "mxgraph-js";
import { Radio, Divider } from "antd";
import CollectionEditForm from "./component/EditNode";
import EdgeEditForm from "./component/EditEdge";

// xml-< json
class mxCellAttributeChange {
  // constructor
  constructor(cell, attribute, value) {
    this.cell = cell;
    this.attribute = attribute;
    this.value = value;
    this.previous = value;
  }
  // Method
  execute() {
    if (this.cell != null) {
      var tmp = this.cell.getAttribute(this.attribute);

      if (this.previous == null) {
        this.cell.value.removeAttribute(this.attribute);
      } else {
        this.cell.setAttribute(this.attribute, this.previous);
      }

      this.previous = tmp;
    }
  }
}
class JsonCodec extends mxObjectCodec {
  constructor() {
    super(value => {});
  }
  encode(value) {
    const xmlDoc = mxUtils.createXmlDocument();
    const newObject = xmlDoc.createElement("NodeObject");
    for (let prop in value) {
      newObject.setAttribute(prop, value[prop]);
    }
    return newObject;
  }
  decode(model) {
    return Object.keys(model.cells)
      .map(iCell => {
        const currentCell = model.getCell(iCell);
        return currentCell.value !== undefined ? currentCell : null;
      })
      .filter(item => item !== null);
  }
}

class mxGraphGridAreaEditor extends Component {
  constructor(props) {
    super(props);
    this.state = {
      graph: {},
      layout: {},
      json: {},
      dragElt: null,
      editVisible: false,
      editEdgeVisible : false,
      currentNode: null,
      selectedNodeType : "Unit",
      selectedEdgeType : "Double",
      selectedEdgeDesc : "Forward",
      edgeDesc : {"Forward": 0, "Left": -1, "Right": 1, "Up": 2, "Down":-2, "See":3},
      edgeDescRev : {'0': "Forward", '-1' : "Left",'1': "Right", '2': "Up", "-2":"Down", 3:"See"}
    };
    this.LoadGraph = this.LoadGraph.bind(this);
  }
  componentDidMount() {
    this.LoadGraph();
  }

  renderJSON = (dataModel, graph) => {
    const jsonEncoder = new JsonCodec();
    let vertices = {};
    const parent = graph.getDefaultParent();
    graph.getModel().beginUpdate(); // Adds cells to the model in a single step
    try {
      dataModel &&
        dataModel.graph.map(node => {
          if(node.edge){
            graph.insertEdge(
              parent,
              null,
              node.value,
              vertices[node.source],
              vertices[node.target],
              node.style
            );
          }else{
            const xmlNode = jsonEncoder.encode(node.value);
            vertices[node.id] = graph.insertVertex(
              parent,
              null,
              xmlNode,
              node.geometry.x,
              node.geometry.y,
              node.geometry.width,
              node.geometry.height,
              node.style
            );
          }
          return 0;
        });
    } finally {
      graph.getModel().endUpdate(); // Updates the display
    }
  };

  getJsonModel = graph => {
    const encoder = new JsonCodec();
    const jsonModel = encoder.decode(graph.getModel());
    return {
      graph: jsonModel
    };
  };

  stringifyWithoutCircular = json => {
    return JSON.stringify(
      json,
      (key, value) => {
        if (
          (key === "parent" || key == "source" || key == "target") &&
          value !== null
        ) {
          return value.id;
        } else if (key === "value" && value !== null && value.localName) {
          let results = {};
          Object.keys(value.attributes).forEach(attrKey => {
            const attribute = value.attributes[attrKey];
            results[attribute.nodeName] = attribute.nodeValue;
          });
          return results;
        }
        return value;
      },
      4
    );
  };
  addChild= (graph,cell,direction) =>{
    var parent = graph.getDefaultParent();
    //offset for the position of the next node
    var offset_x = 0;
    var offset_y = 0;
    //offset for the connection constraints
    var exitX = 0;
    var exitY = 0;
    var entryX = 0;
    var entryY = 0;
    //adjust the content for the next node to be added
    switch(direction){
      case 'up':
        offset_y = -100;
        exitX = 0.5;
        exitY = 0;
        entryX = 0.5;
        entryY = 1;
        break;
      case 'down':
        offset_y = 100;
        exitX = 0.5;
        exitY = 1;
        entryX = 0.5;
        entryY = 0;
        break;
      case 'left':
        offset_x = -200;
        exitX = 0;
        exitY = 0.5;
        entryX = 1;
        entryY = 0.5;
        break;
      case 'right':
        offset_x = 200;
        exitX = 1;
        exitY = 0.5;
        entryX = 0;
        entryY = 0.5;
        break;
      default:
        break;
    }
    //template for the style of the next edge
    var style = `edgeStyle=orthogonalEdgeStyle;exitX=${exitX};exitY=${exitY};entryX=${entryX};entryY=${entryY};`;

    //update the model
    graph.getModel().beginUpdate();
          try {
            var doc = mxUtils.createXmlDocument();
            var obj = doc.createElement("NodeObject");
            obj.setAttribute("label", this.state.selectedNodeType);
            obj.setAttribute("text", "Default Name");
            obj.setAttribute("desc", "Default Description");
            //make new cell
            let curCell = graph.insertVertex(
              parent,
              null,
              obj,
              cell.geometry.x + offset_x,
              cell.geometry.y + offset_y,
              150,
              60,
              "strokeColor=#000000;strokeWidth=1;fillColor=white");
            //insert edge from previous cell to next
            let values = {
            "desc" : this.state.edgeDesc[this.state.selectedEdgeDesc],
            "special":((this.state.selectedEdgeType == "Double")? false:true),
            "src": (cell.getAttribute("text"))? cell.getAttribute("text"): "default",
            "src_desc" : (cell.getAttribute("desc"))? cell.getAttribute("desc"): "default",
            "dest" : (curCell.getAttribute("text"))? curCell.getAttribute("text"):"default",
            "dest_desc" : (curCell.getAttribute("desc"))? curCell.getAttribute("desc"):"default"
            }
            graph.insertEdge(
              parent,
              null,
              values,
              cell,
              curCell,
              style,
              );
            graph.setSelectionCell(curCell);
          } finally {
            // Updates the display
            graph.getModel().endUpdate();
          }

  };

  removeOverlays = (graph,cell) =>{
    graph.removeCellOverlays(cell);
  }

  removeAllCells = (graph) =>{
    let cells = graph.model.cells;
    //skip the first 2 because they are default root not visible on the graph
    for(var obj in cells){
      if(!(obj in [0,1])){
        graph.removeCells([cells[obj]])
      }

    }
  }
  addOverlays = (graph, cell) => {
    var overlay1 = new mxCellOverlay(
      new mxImage(
        "https://uploads.codesandbox.io/uploads/user/4bf4b6b3-3aa9-4999-8b70-bbc1b287a968/jEU_-add.png",
        16,
        16
      ),
      "add link"
    );
    overlay1.cursor = "hand";
    overlay1.align = mxConstants.ALIGN_CENTER;
    overlay1.offset = new mxPoint(0, 20);
    overlay1.addListener(
      mxEvent.CLICK,
      mxUtils.bind(this, function(sender, evt) {
        this.addChild(graph, cell, "down");
      })
    );
    var overlay2 = new mxCellOverlay(
      new mxImage(
        "https://uploads.codesandbox.io/uploads/user/4bf4b6b3-3aa9-4999-8b70-bbc1b287a968/jEU_-add.png",
        16,
        16
      ),
      "add link"
    );

    overlay2.cursor = "hand";
    overlay2.align = mxConstants.ALIGN_CENTER;
    overlay2.verticalAlign = mxConstants.ALIGN_TOP;
    overlay2.offset = new mxPoint(0, -20);
    overlay2.addListener(
      mxEvent.CLICK,
      mxUtils.bind(this, function(sender, evt) {
        this.addChild(graph, cell,"up");
      })
    );

    var overlay3 = new mxCellOverlay(
      new mxImage(
        "https://uploads.codesandbox.io/uploads/user/4bf4b6b3-3aa9-4999-8b70-bbc1b287a968/jEU_-add.png",
        16,
        16
      ),
      "add link"
    );
    overlay3.cursor = "hand";
    overlay3.align = mxConstants.ALIGN_LEFT;
    overlay3.verticalAlign = mxConstants.ALIGN_MIDDLE;
    overlay3.offset = new mxPoint(-20, 0);
    overlay3.addListener(
      mxEvent.CLICK,
      mxUtils.bind(this, function(sender, evt) {
        this.addChild(graph, cell,"left");
      })
    );
    var overlay4 = new mxCellOverlay(
      new mxImage(
        "https://uploads.codesandbox.io/uploads/user/4bf4b6b3-3aa9-4999-8b70-bbc1b287a968/jEU_-add.png",
        16,
        16
      ),
      "add link"
    );
    overlay4.cursor = "hand";
    overlay4.align = mxConstants.ALIGN_RIGHT;
    overlay4.verticalAlign = mxConstants.ALIGN_MIDDLE;
    overlay4.offset = new mxPoint(20,0);
    overlay4.addListener(
      mxEvent.CLICK,
      mxUtils.bind(this, function(sender, evt) {
        this.addChild(graph, cell,"right");
      })
    );
    graph.addCellOverlay(cell, overlay1);
    graph.addCellOverlay(cell, overlay2);
    graph.addCellOverlay(cell, overlay3);
    graph.addCellOverlay(cell, overlay4);
  };


  handleCancel = () =>{
    this.setState({
      editVisible : false,
      editEdgeVisible : false
    });
  }
  handleConfirm = values =>{
    const {graph} = this.state;
    const cell =graph.getSelectionCell();
    this.applyHandler(graph, cell,"text",values.nodeTitle);
    this.applyHandler(graph, cell,"desc",values.description);  
    //update all edges linked to the currently edited cell
    this.updateEdges(graph, cell);

    this.setState({
      editVisible: false
    });
  }
  getCurNodeTitle (){
    const{graph} = this.state;
    const cell =graph.getSelectionCell();
    return cell.getAttribute("text")
  }
  getCurNodeDesc (){
    const{graph} = this.state;
    const cell =graph.getSelectionCell();
    return cell.getAttribute("desc")
  }
  getCurEdgeDesc (){
    const{graph} = this.state;
    const edge =graph.getSelectionCell();
    return this.state.edgeDescRev[edge.value.desc]
  }
  handleEditEdgeConfirm = values =>{
    const {graph} = this.state;
    const edge =graph.getSelectionCell();
    let curVal = edge.value
    curVal.desc = this.state.edgeDesc[values.edgeDesc]
    graph.getModel().setValue(edge,curVal);
    console.log(values)
    console.log(edge)
    this.setState({
      editEdgeVisible : false
    });
  }
  updateEdges =(graph, cell) =>{
    if(cell.edges){
      for(var i =0;i<cell.edges.length;i++){
        var curEdge = cell.edges[i];
        console.log(curEdge)
        if (curEdge.source === cell){
          curEdge.value["src"] = cell.getAttribute("text");
          curEdge.value["src_desc"] = cell.getAttribute("desc");
        }
        else{
          curEdge.value["dest"] = cell.getAttribute("text");
          curEdge.value["dest_desc"] = cell.getAttribute("desc");
        }
        console.log(curEdge)
      }
    }
  }
  handleSaveToPC = jsonData => {
    const fileData = this.stringifyWithoutCircular(jsonData);
    const blob = new Blob([fileData], {type: "text/plain"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'graph.json';
    link.href = url;
    link.click();
  }
  applyHandler = (graph, cell, name, newValue) => {

    graph.getModel().beginUpdate();
    try {
      const edit = new mxCellAttributeChange(cell, name, newValue);
      graph.getModel().execute(edit);
    } finally {
      graph.getModel().endUpdate();
    }
  };
  graphF = evt => {
    const { graph } = this.state;
    var x = mxEvent.getClientX(evt);
    var y = mxEvent.getClientY(evt);
    var elt = document.elementFromPoint(x, y);
    if (mxUtils.isAncestorNode(graph.container, elt)) {
      return graph;
    }
    return null;
  };
  loadGlobalSetting = () => {
    // Enable alignment lines to help locate
    mxGraphHandler.prototype.guidesEnabled = true;
    // Alt disables guides
    mxGuide.prototype.isEnabledForEvent = function(evt) {
      return !mxEvent.isAltDown(evt);
    };
    // Specifies if waypoints should snap to the routing centers of terminals
    mxEdgeHandler.prototype.snapToTerminals = true;
    mxConstraintHandler.prototype.pointImage = new mxImage(
      "https://uploads.codesandbox.io/uploads/user/4bf4b6b3-3aa9-4999-8b70-bbc1b287a968/-q_3-point.gif",
      10,
      10
    );
  };
  //set the preview for dragging elements
  getEditPreview = () => {
    var dragElt = document.createElement("div");
    dragElt.style.border = "dashed black 1px";
    dragElt.style.width = "120px";
    dragElt.style.height = "40px";
    return dragElt;
  };
  

  createPopupMenu = (graph, menu, cell, evt) => {
    if (cell) {
      const that = this;
      if (cell.edge === true) {
        menu.addItem("Edit connection", null, function() {
          that.setState({editEdgeVisible: true})
        });
        menu.addItem("Delete connection", null, function() {
          graph.removeCells([cell]);
          mxEvent.consume(evt);
        });
      } else {
        menu.addItem("Edit node", null, function() {
          that.setState({editVisible : true});
        });
        menu.addItem("Delete node", null, function() {
          graph.removeCells([cell]);
          mxEvent.consume(evt);
        });
      }
    }
  };
  setGraphSetting = () => {
    const { graph } = this.state;
    const that = this;
    graph.gridSize = 30;
    graph.setPanning(true);
    graph.setTooltips(true);
    graph.setConnectable(true);
    graph.setCellsEditable(true);
    graph.setEnabled(true);
    graph.setHtmlLabels(true);
    graph.centerZoom = true;
    graph.autoSizeCellsOnAdd = true;
    var undoManager = new mxUndoManager();
    var listener = function(sender, evt) {
      undoManager.undoableEditHappened(evt.getProperty("edit"));
    };
    graph.getModel().addListener(mxEvent.UNDO, listener);
    graph.getView().addListener(mxEvent.UNDO, listener);

    const keyHandler = new mxKeyHandler(graph);
    keyHandler.bindKey(46, function(evt) {
      if (graph.isEnabled()) {
        const currentNode = graph.getSelectionCell();
        graph.removeCells([currentNode]);
      }
    });
    keyHandler.bindControlKey(90, function(evt){
      undoManager.undo();
    });
    keyHandler.bindControlKey(89, function(evt){
      undoManager.redo();
    });

    keyHandler.bindKey(37, function() {
      console.log(37);
    });

    new mxRubberband(graph);
    graph.getTooltipForCell = function(cell) {
      return cell.getAttribute("desc");
    };
    var style = [];
    style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_RECTANGLE;
    style[mxConstants.STYLE_PERIMETER] = mxPerimeter.RectanglePerimeter;
    style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_MIDDLE;
    style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_CENTER;
    style[mxConstants.STYLE_FILLCOLOR] = "#C3D9FF";
    style[mxConstants.STYLE_STROKECOLOR] = "#6482B9";
    style[mxConstants.STYLE_FONTCOLOR] = "#774400";
    style[mxConstants.HANDLE_FILLCOLOR] = "#80c6ee";
    graph.getStylesheet().putDefaultVertexStyle(style);

    style = [];
    style[mxConstants.STYLE_STROKECOLOR] = "#f90";
    style[mxConstants.STYLE_SHAPE] = mxConstants.SHAPE_CONNECTOR;
    style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_CENTER;
    style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_MIDDLE;
    style[mxConstants.STYLE_EDGE] = mxEdgeStyle.ElbowConnector;
    style[mxConstants.STYLE_STARTARROW] = mxConstants.ARROW_CLASSIC;
    style[mxConstants.STYLE_FONTSIZE] = "10";
    style[mxConstants.VALID_COLOR] = "#27bf81";
    style[mxConstants.STYLE_ENDARROW] = mxConstants.ARROW_CLASSIC;
    graph.getStylesheet().putDefaultEdgeStyle(style);

    graph.popupMenuHandler.factoryMethod = function(menu, cell, evt) {
      return that.createPopupMenu(graph, menu, cell, evt);
    };
    graph.convertValueToString = function(cell) {
      if (
        mxUtils.isNode(cell.value) &&
        cell.value.nodeName.toLowerCase() == "nodeobject"
      ) {
        // Returns a DOM for the label
        var div = document.createElement("div");
        div.setAttribute("class", "nodeWrapper");
        div.innerHTML = `<span class='nodeTitle'>${cell.getAttribute(
          "text"
        )}</span>`;
        mxUtils.br(div);

        var p = document.createElement("p");
        p.setAttribute("class", "nodeName");
        p.innerHTML = cell.getAttribute("label");
        div.appendChild(p);
        return div;
      }
      else{
        var div = document.createElement("div");
        div.setAttribute("class", "edgeWrapper");
        div.innerHTML = `<span class='edgeTitle'>${cell.value.desc}</span>`;
        return div;
        console.log(cell.value.desc)
        //for edges return the value
        return `${cell.value.desc}`;
      }
    };
  };

  funct = (graph, evt, target, x, y, value) => {
    var doc = mxUtils.createXmlDocument();
    var obj = doc.createElement("NodeObject");
    obj.setAttribute("label", value);
    obj.setAttribute("text", "Default Name");
    obj.setAttribute("desc", "Default Description");

    var parent = graph.getDefaultParent();
    let cell = graph.insertVertex(
      parent,
      target,
      obj,
      x,
      y,
      150,
      60,
      "strokeColor=#000000;strokeWidth=1;fillColor=white"
    );
    graph.setSelectionCell(cell);
  };

  setLayoutSetting = layout => {
    layout.parallelEdgeSpacing = 10;
    layout.useBoundingBox = false;
    layout.edgeRouting = false;
    layout.levelDistance = 60;
    layout.nodeDistance = 16;
    layout.parallelEdgeSpacing = 10;
    layout.isVertexMovable = function(cell) {
      return true;
    };
    layout.localEdgeProcessing = function(node) {
      console.log(node);
    };
  };
  selectionChange = (sender, evt) => {
    var graph = sender.graph;
    var prev = evt.properties.added[0];
    var cur = graph.getSelectionCell();
    if(prev){
      if(mxUtils.isNode(prev.value)){
        this.removeOverlays(graph,prev);
      }
    }
    if(cur){
      //if selected is a node
      if(mxUtils.isNode(cur.value)){
        console.log(cur)
        this.addOverlays(graph, cur);
        
      }
      else{
        console.log(cur)
      }
    }
  };
  settingConnection = () => {
    const { graph } = this.state;
    mxConstraintHandler.prototype.intersects = function(
      icon,
      point,
      source,
      existingEdge
    ) {
      return !source || existingEdge || mxUtils.intersects(icon.bounds, point);
    };

    var mxConnectionHandlerUpdateEdgeState = mxConnectionHandler.prototype.updateEdgeState;
    mxConnectionHandler.prototype.updateEdgeState = function(pt, constraint) {
      if (pt != null && this.previous != null) {
        var constraints = this.graph.getAllConnectionConstraints(this.previous);
        var nearestConstraint = null;
        var dist = null;

        for (var i = 0; i < constraints.length; i++) {
          var cp = this.graph.getConnectionPoint(this.previous, constraints[i]);

          if (cp != null) {
            var tmp =
              (cp.x - pt.x) * (cp.x - pt.x) + (cp.y - pt.y) * (cp.y - pt.y);

            if (dist == null || tmp < dist) {
              nearestConstraint = constraints[i];
              dist = tmp;
            }
          }
        }
        //this is used to snap the source connection to the nearest constraint on the target
        //disabled as not needed
        if (nearestConstraint != null) {
          //this.sourceConstraint = nearestConstraint;
        }

        // In case the edge style must be changed during the preview:
        // this.edgeState.style['edgeStyle'] = 'orthogonalEdgeStyle';
        // And to use the new edge style in the new edge inserted into the graph,
        // update the cell style as follows:
        //this.edgeState.cell.style = mxUtils.setStyle(this.edgeState.cell.style, 'edgeStyle', this.edgeState.style['edgeStyle']);
      }

      mxConnectionHandlerUpdateEdgeState.apply(this, arguments);
    };

    if (graph.connectionHandler.connectImage == null) {
      graph.connectionHandler.isConnectableCell = function(cell) {
        return false;
      };
      mxEdgeHandler.prototype.isConnectableCell = function(cell) {
        return graph.connectionHandler.isConnectableCell(cell);
      };
    }

    graph.getAllConnectionConstraints = function(terminal) {
      if (terminal != null && this.model.isVertex(terminal.cell)) {
        return [
          new mxConnectionConstraint(new mxPoint(0.5, 0), true),
          new mxConnectionConstraint(new mxPoint(0, 0.5), true),
          new mxConnectionConstraint(new mxPoint(1, 0.5), true),
          new mxConnectionConstraint(new mxPoint(0.5, 1), true)
        ];
      }
      return null;
    };
    const that = this
    // Connect preview
    graph.connectionHandler.createEdgeState = function(me) {
      console.log(that.state.selectedEdgeDesc);
      let values = {
      
        "desc" : that.state.edgeDesc[that.state.selectedEdgeDesc],
        "special":((that.state.selectedEdgeType == "Double")? false:true),
        "src": "default",
        "src_desc" : "default",
        "dest" : "default",
        "dest_desc" : "default"
        }
      
      var edge = graph.createEdge(
        null,
        null,
        values,
        null,
        null,
        "edgeStyle=orthogonalEdgeStyle"
      );

      return new mxCellState(
        this.graph.view,
        edge,
        this.graph.getCellStyle(edge)
      );
    };
  };
  initToolbar = () => {
    const that = this;
    const { graph } = this.state;
    var toolbar = ReactDOM.findDOMNode(this.refs.toolbar);
    toolbar.appendChild(
      mxUtils.button("zoom(+)", function(evt) {
        graph.zoomIn();
      })
    );
    toolbar.appendChild(
      mxUtils.button("zoom(-)", function(evt) {
        graph.zoomOut();
      })
    );
    toolbar.appendChild(
      mxUtils.button("restore", function(evt) {
        graph.zoomActual();
        const zoom = { zoomFactor: 1.2 };
        that.setState({
          graph: { ...graph, ...zoom }
        });
      })
    );
    toolbar.appendChild(
      mxUtils.button("new graph", function(evt) {
        that.removeAllCells(graph);
      })
    );
    toolbar.appendChild(
      mxUtils.button("download graph", function() {
        const copyToClipboard = str => {
          const el = document.createElement('textarea');
          el.value = str;
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          document.body.removeChild(el);
        };

        const jsonNodes = that.getJsonModel(graph);
        let jsonStr = that.stringifyWithoutCircular(jsonNodes);
        
        that.handleSaveToPC(jsonNodes);
        copyToClipboard(jsonStr)
        localStorage.setItem("json", jsonStr);
        that.setState({
          json: jsonStr
        });
        that.state.json = jsonStr;
        console.log(jsonStr);

      })
    );
    toolbar.appendChild(
      mxUtils.button("render graph", function() {
        //remove all current cells from graph
        that.removeAllCells(graph);
        that.renderJSON(JSON.parse(JSON.stringify(jsonGraph)),graph);
      })
    );

  };
  LoadGraph(data) {
    var container = ReactDOM.findDOMNode(this.refs.divGraph);
    // Checks if the browser is supported
    if (!mxClient.isBrowserSupported()) {
      // Displays an error message if the browser is not supported.
      mxUtils.error("Browser is not supported!", 200, false);
    } else {
      var graph = new mxGraph(container);
      this.setState(
        {
          graph: graph,
          dragElt: this.getEditPreview()
        },
        () => {
          // layout
          const layout = new mxCompactTreeLayout(graph, false);
          this.setState({ layout });
          this.setLayoutSetting(layout);
          this.loadGlobalSetting();
          this.setGraphSetting();
          this.initToolbar();
          this.settingConnection();

          //use this to add the graph by default later
          //var parent = graph.getDefaultParent();

          // Adds cells to the model in a single step
          graph.getModel().beginUpdate();
          try {
            
          } finally {
            // Updates the display
            graph.getModel().endUpdate();
          }
        }
      );
      // Disables the built-in context menu
      mxEvent.disableContextMenu(container);
      // Trigger event after selection
      graph
        .getSelectionModel()
        .addListener(mxEvent.CHANGE, this.selectionChange);
      var that = this;
      graph.addMouseListener(
        {
          mouseDown: function(sender, evt)
          {},
          mouseMove: function(sender, evt)
          {},
          mouseUp: function(sender, evt)
          {
            if(evt.evt.ctrlKey){
              that.funct(graph, evt, null,evt.graphX, evt.graphY, that.state.selectedNodeType);
            }
          }
        });
      graph.addListener(mxEvent.DOUBLE_CLICK, function(sender, evt){
        console.log(that.state.selectedNodeType);
      });

    }
  }
  onNodeTypeChange = e =>{
    this.setState({
      selectedNodeType : e.target.value,
      selectedEdgeDesc : "Forward"
    });
  }
  onEdgeTypeChange = e =>{
    this.setState({
      selectedEdgeType : e.target.value
    });
    var edgeStyle = this.state.graph.getStylesheet().getDefaultEdgeStyle();
    if(e.target.value == "Double"){
      console.log("Double")
      edgeStyle[mxConstants.STYLE_STARTARROW] = mxConstants.ARROW_CLASSIC
    }else{
      console.log("Single")
      edgeStyle[mxConstants.STYLE_STARTARROW] = mxConstants.NONE
    }
    this.state.graph.getStylesheet().putDefaultEdgeStyle(edgeStyle);
    console.log(this.state.graph.getStylesheet().getDefaultEdgeStyle());
  }
  onEdgeDescChange =e =>{
    this.setState({
      selectedEdgeDesc : e.target.value
    })
  }
  render() {
    const nodeOptions = ["Unit","Elevator","Cluster"];
    const edgeOptions =["Double","Single"];
    const edgeDesc = ["Forward", "Left","Right","See","Up","Down"];

    return (
      <div>
        <ul className="sidebar" ref="mxSidebar">
          <li className="title" data-title="Node Type" data-value="Node Type">
            Node Type
          </li>
          <Radio.Group onChange={this.onNodeTypeChange} className = {"node-type"} options = {nodeOptions} optionType = "button" defaultValue = {this.state.selectedNodeType}>
          </Radio.Group>
          <Divider style={{margin : "10px 0px"}}/>
          <li className="title" data-title="Vertex node" data-value="Edge type">
            Edge Type
          </li>
          <Radio.Group onChange={this.onEdgeTypeChange} className = {"edge-type"} options = {edgeOptions} optionType = "button" defaultValue = {this.state.selectedEdgeType}>
          </Radio.Group>
          <Divider style={{margin : "10px 0px"}}/>
          <li className="title" data-title="Vertex node" data-value="Edge type">
            Edge Description
          </li>
          <Radio.Group className = {"edge-type"} options = {edgeDesc} 
          optionType = "button" defaultValue = {this.state.selectedEdgeDesc} onChange ={this.onEdgeDescChange}
          />

        </ul>
        <div className="toolbar" ref="toolbar" />
        <div className="container-wrapper">
          <div className="container" ref="divGraph" />
        </div>
        <div className="changeInput" style={{ zIndex: 10 }} />
        {this.state.editVisible && (
          <CollectionEditForm 
            visible ={this.state.editVisible}
            selectedNodeType = {this.state.selectedNodeType}
            nodeTitle = {this.getCurNodeTitle()}
            nodeDesc = {this.getCurNodeDesc()}
            onCreate = {this.handleConfirm}
            onCancel = {this.handleCancel}
          />
        )}

        {this.state.editEdgeVisible && (
          <EdgeEditForm 
            selectedEdgeType = {this.state.selectedEdgeType}
            selectedEdgeDesc = {this.getCurEdgeDesc()}
            edgeTypeOptions = {edgeOptions}
            edgeDescOptions = {edgeDesc}
            visible ={this.state.editEdgeVisible}
            selectedNodeType = {this.state.selectedNodeType}
            onCreate = {this.handleEditEdgeConfirm}
            onCancel = {this.handleCancel}
          />
        )}
      </div>
    );
  }
}

export default mxGraphGridAreaEditor;
