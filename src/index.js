import React from "react";
import ReactDOM from "react-dom";
import MxGraphEditor from "./MxGraphGridEditor";
import "antd/dist/antd.css";
import "./styles.css";
import "./index.css";

const rootElement = document.getElementById("root");
ReactDOM.render(<MxGraphEditor  />, rootElement);
