import { STATE, ARRAY_EMPTY, NODE_NAME, NODE_HOST } from "./constants";
import { isArray } from "./utils";
import { toVnode } from "./vnode";
import { options } from "./options";
import { diffProps } from "./diffProps";
import { createComponent } from "./component";
import { COMPONENT_UPDATE } from "./constants";

export function diff(
    ID,
    node,
    nextVnode,
    context,
    isSvg,
    currentUpdateComponent
) {
    let { vnode, updateComponent, handlers = {} } = (node && node[ID]) || {};

    if (vnode === nextVnode) return node;

    vnode = vnode || { props: {} };

    let { type, props } = nextVnode,
        { shadowDom, children } = props,
        isComponent = typeof type === "function";

    isSvg = isSvg || type === "svg";

    if (isComponent && !updateComponent) {
        updateComponent = createComponent(ID, isSvg);
    }
    if (!isComponent && type != NODE_HOST && getNodeName(node) !== type) {
        let nextNode = createNode(nextVnode.type),
            parent = node && node.parentNode;

        if (parent) {
            unmount(ID, node, true, currentUpdateComponent);
            parent.replaceChild(nextNode, node);
        }

        node = nextNode;
        handlers = {};
    }
    if (updateComponent && currentUpdateComponent != updateComponent) {
        return updateComponent(COMPONENT_UPDATE, node, nextVnode, context);
    } else if (type == null) {
        if (node.nodeValue != children) {
            node.nodeValue = children;
        }
    } else {
        let ignoreChildren = diffProps(
            node,
            vnode.props,
            nextVnode.props,
            isSvg,
            handlers
        );
        if (!ignoreChildren && vnode.props.children != children) {
            diffChildren(
                ID,
                shadowDom ? node.shadowRoot || node : node,
                children,
                context,
                isSvg
            );
        }
    }
    node[ID] = { vnode: nextVnode, handlers };
    return node;
}

export function diffChildren(ID, parent, nextChildren, context, isSvg) {
    let keyes = [],
        children = toChildren(nextChildren, false, keyes),
        childrenLenght = children.length;

    let childNodes = parent.childNodes,
        childNodesKeyes = {},
        childNodesLength = childNodes.length,
        withKeyes = keyes.withKeyes,
        index = withKeyes
            ? 0
            : childNodesLength > childrenLenght
            ? childrenLenght
            : childNodesLength;

    for (; index < childNodesLength; index++) {
        let childNode = childNodes[index],
            isRemove,
            key = index;
        if (withKeyes) {
            key = childNode.dataset.key;
            if (keyes.indexOf(key) > -1) {
                childNodesKeyes[key] = childNode;
                continue;
            }
        }
        unmount(ID, childNode);
        index--;
        childNodesLength--;
        parent.removeChild(childNode);
    }
    for (let i = 0; i < childrenLenght; i++) {
        let child = children[i],
            indexChildNode = childNodes[i],
            nextSiblingChildNode = childNodes[i + 1],
            key = withKeyes ? child.key : i,
            childNode = withKeyes ? childNodes[key] : indexChildNode;

        if (withKeyes) {
            if (childNode != indexChildNode) {
                parent.insertBefore(childNode, indexChildNode);
            }
        }
        if (typeof child.type === "function") {
            if (!childNode) {
                childNode = createNode(null);
                if (nextSiblingChildNode) {
                    parent.insertBefore(childNode, nextSiblingChildNode);
                } else {
                    parent.appendChild(childNode);
                }
            }
        }

        let nextChildNode = diff(ID, childNode || null, child, context, isSvg);

        if (!childNode) {
            if (nextSiblingChildNode) {
                parent.insertBefore(nextChildNode, nextSiblingChildNode);
            } else {
                parent.appendChild(nextChildNode);
            }
        }
    }
}

function unmount(ID, node, clear, currentUpdateComponent) {
    let { updateComponent } = node[ID] || {},
        childNodes = node.childNodes,
        length = childNodes.length;
    if (updateComponent && updateComponent != currentUpdateComponent) {
        updateComponent(clear ? COMPONENT_CLEAR : COMPONENT_REMOVE);
    }
    for (let i = 0; i < length; i++) {
        clearNode(childNodes[i]);
    }
}

export function createNode(type, isSvg) {
    let doc = options.document || document,
        nextNode;
    if (type != null) {
        nextNode = isSvg
            ? doc.createElementNS("http://www.w3.org/2000/svg", type)
            : doc.createElement(type);
    } else {
        nextNode = doc.createTextNode("");
    }
    nextNode[NODE_NAME] = type;
    return nextNode;
}

export function getNodeName(node) {
    if (!node) return;
    // store the process locally in the node to avoid transformation
    if (!node[NODE_NAME]) {
        let nodeName = node.nodeName.toLowerCase();
        node[NODE_NAME] = nodeName == "#text" ? null : nodeName;
    }
    return node[NODE_NAME];
}

export function toChildren(children, map, keyes, list, deep = 0) {
    keyes = keyes || [];
    list = list || [];

    if (isArray(children)) {
        let length = children.length;
        for (let i = 0; i < length; i++) {
            let child = children[i];
            if (isArray(child)) {
                toChildren(child, map, keyes, list, deep + 1);
            } else {
                toChildren(child, map, keyes, list, deep + 1);
            }
        }
    } else {
        if (children == null && !deep) return ARRAY_EMPTY;
        let vnode = map ? map(vnode, list.length) : toVnode(children);
        if (!map) {
            if (typeof vnode == "object") {
                if (vnode.key != undefined) {
                    if (keyes.indexOf(vnode.key) === -1) {
                        keyes.push(vnode.key);
                        keyes.withKeyes = true;
                    } else {
                        throw new Error(
                            "Each key must be unique among children"
                        );
                    }
                }
            } else {
                if (keyes.withKeyes) {
                    throw new Error("Each child must have a key");
                }
            }
        }
        list.push(vnode);
    }
    return list;
}
