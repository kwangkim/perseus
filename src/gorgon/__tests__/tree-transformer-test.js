const assert = require("assert");
const PerseusMarkdown = require("../../perseus-markdown.jsx");
const parse = PerseusMarkdown.parse;

const TreeTransformer = require("../tree-transformer.js");

describe("gorgon tree transformer", () => {
    function clone(o) {
        return JSON.parse(JSON.stringify(o));
    }

    const tree1 = {
        id: 0,
        type: "root",
        content: [
            {id: 1, type: "text", content: "Hello, "},
            {
                id: 2,
                type: "em",
                content: {
                    id: 3,
                    type: "text",
                    content: "World!",
                },
            },
            {
                id: 4,
                type: "list",
                items: [
                    {id: 5, type: "text", content: "A"},
                    {id: 6, type: "text", content: "B"},
                    {id: 7, type: "text", content: "C"},
                ],
            },
        ],
    };

    // These are three variants on the same tree where we use arrays
    // instead of single nodes. The tests below will be run over all
    // four variants, and should work the same for all.
    const tree2 = [clone(tree1)];
    const tree3 = clone(tree1);
    tree3.content[1].content = [tree3.content[1].content];
    const tree4 = clone(tree2);
    tree4[0].content[1].content = [tree4[0].content[1].content];

    const trees = [tree1, tree2, tree3, tree4];

    const postOrderTraversalOrder = [1, 3, 2, 5, 6, 7, 4, 0];
    const previousNodeIds = [-1, -1, 1, -1, 2, -1, 5, 6];
    const nextNodeIds = [-1, 2, 4, -1, -1, 6, 7, -1];

    // The first test will fill in this array mapping numbers to nodes
    // Then subsequent tests can use it
    const nodes = [];

    function getTraversalOrder(tree) {
        const order = [];
        new TreeTransformer(tree).traverse((n, state) => {
            order.push(n.id);
        });
        return order;
    }

    trees.forEach((tree, treenum) => {
        it(
            "does post-order traversal of each node in the tree " + treenum,
            () => {
                const tt = new TreeTransformer(tree);
                const ids = [];

                tt.traverse(n => {
                    nodes[n.id] = n; // Remember the nodes by id for later tests
                    ids.push(n.id);
                });

                // Post-order traversal means we visit the nodes on the way
                // back up, not on the way down.
                assert.deepEqual(ids, postOrderTraversalOrder);
            }
        );

        it("tracks the current node and current type " + treenum, () => {
            new TreeTransformer(tree).traverse((n, state) => {
                assert.equal(state.currentNode(), n);
                assert.equal(state.currentNodeType(), n.type);
            });
        });

        it("correctly gets the siblings for each node " + treenum, () => {
            new TreeTransformer(tree).traverse((n, state) => {
                const previd = previousNodeIds[n.id];
                assert.equal(
                    state.previousSibling(),
                    previd >= 0 ? nodes[previd] : null
                );

                const nextid = nextNodeIds[n.id];
                assert.equal(
                    state.nextSibling(),
                    nextid >= 0 ? nodes[nextid] : null
                );
            });
        });

        it(
            "knows the ancestors and ancestor types for each node: " + treenum,
            () => {
                const ancestorsById = [
                    [],
                    [0],
                    [0],
                    [0, 2],
                    [0],
                    [0, 4],
                    [0, 4],
                    [0, 4],
                ];
                const ancestorTypesById = [
                    [],
                    ["root"],
                    ["root"],
                    ["root", "em"],
                    ["root"],
                    ["root", "list"],
                    ["root", "list"],
                    ["root", "list"],
                ];

                new TreeTransformer(tree).traverse((n, state) => {
                    assert.deepEqual(
                        state.ancestors(),
                        ancestorsById[n.id].map(id => nodes[id])
                    );
                    assert.deepEqual(
                        state.ancestorTypes(),
                        ancestorTypesById[n.id]
                    );
                });
            }
        );

        it("computes the textContent for each node " + treenum, () => {
            const textContentForNode = [
                "Hello, World!ABC",
                "Hello, ",
                "World!",
                "World!",
                "ABC",
                "A",
                "B",
                "C",
            ];

            new TreeTransformer(tree).traverse((n, state) => {
                assert.equal(state.textContent(), textContentForNode[n.id]);
            });
        });

        it("can remove the next sibling " + treenum, () => {
            const expectedTraversals = [
                // if a node has no next sibling, the test is a no-op
                postOrderTraversalOrder,
                [1, 5, 6, 7, 4, 0],
                [1, 3, 2, 0],
                postOrderTraversalOrder,
                postOrderTraversalOrder,
                [1, 3, 2, 5, 7, 4, 0],
                [1, 3, 2, 5, 6, 4, 0],
                postOrderTraversalOrder,
            ];

            // For each node in the tree
            for (let id = 0; id < nodes.length; id++) {
                // Start with a copy of the tree
                const copy = clone(tree);

                // Remove the next sibling of the node with this id
                new TreeTransformer(copy).traverse((n, state) => {
                    if (n.id === id) {
                        state.removeNextSibling();
                    }

                    // Ensure that we don't iterate the removed sibling
                    assert.notEqual(n.id, nextNodeIds[id]);
                });

                // And then get the traversal order of the resulting tree
                const traversal = getTraversalOrder(copy);

                // Compare it to the expected value
                assert.deepEqual(traversal, expectedTraversals[id]);
            }
        });

        it("won't try to replace the root of the tree " + treenum, () => {
            const copy = clone(tree);
            new TreeTransformer(copy).traverse((n, state) => {
                if (n === state.root) {
                    assert.throws(() => state.replace());
                }
            });
        });

        it("Can remove nodes " + treenum, () => {
            const expectedTraversals = [
                null,
                [3, 2, 5, 6, 7, 4, 0],
                [1, 5, 6, 7, 4, 0],
                [1, 2, 5, 6, 7, 4, 0],
                [1, 3, 2, 0],
                [1, 3, 2, 6, 7, 4, 0],
                [1, 3, 2, 5, 7, 4, 0],
                [1, 3, 2, 5, 6, 4, 0],
            ];

            // Loop through all the nodes except the root
            for (let id = 1; id < nodes.length; id++) {
                // Make a copy of the tree
                const copy = clone(tree);
                // Remove this node from it
                new TreeTransformer(copy).traverse((n, state) => {
                    if (n.id === id) {
                        state.replace();
                    }
                });

                // Traverse what remains and see if we get what is expected
                assert.deepEqual(
                    getTraversalOrder(copy),
                    expectedTraversals[id]
                );
            }
        });

        it("Can replace nodes " + treenum, () => {
            const expectedTraversals = [
                null,
                [99, 3, 2, 5, 6, 7, 4, 0],
                [1, 99, 5, 6, 7, 4, 0],
                [1, 99, 2, 5, 6, 7, 4, 0],
                [1, 3, 2, 99, 0],
                [1, 3, 2, 99, 6, 7, 4, 0],
                [1, 3, 2, 5, 99, 7, 4, 0],
                [1, 3, 2, 5, 6, 99, 4, 0],
            ];

            // Loop through all the nodes except the root
            for (let id = 1; id < nodes.length; id++) {
                // Make a copy of the tree
                const copy = clone(tree);
                // Replace the node with a different one
                new TreeTransformer(copy).traverse((n, state) => {
                    if (n.id === id) {
                        state.replace({
                            id: 99,
                            type: "replacement",
                        });
                    }

                    // Ensure that we don't traverse the new node
                    assert.notEqual(n.id, 99);
                });

                // Traverse what remains and see if we get what is expected
                assert.deepEqual(
                    getTraversalOrder(copy),
                    expectedTraversals[id]
                );
            }
        });

        it("Can reparent nodes " + treenum, () => {
            const expectedTraversals = [
                null,
                [1, 99, 3, 2, 5, 6, 7, 4, 0],
                [1, 3, 2, 99, 5, 6, 7, 4, 0],
                [1, 3, 99, 2, 5, 6, 7, 4, 0],
                [1, 3, 2, 5, 6, 7, 4, 99, 0],
                [1, 3, 2, 5, 99, 6, 7, 4, 0],
                [1, 3, 2, 5, 6, 99, 7, 4, 0],
                [1, 3, 2, 5, 6, 7, 99, 4, 0],
            ];

            // Loop through all the nodes except the root
            for (let id = 1; id < nodes.length; id++) {
                // Make a copy of the tree
                const copy = clone(tree);
                let count = 0;
                // Replace the node with a different one
                new TreeTransformer(copy).traverse((n, state) => {
                    if (n.id === id) {
                        // Ensure that we don't traverse the node more than once
                        assert.equal(++count, 1);
                        state.replace({
                            id: 99,
                            type: "reparent",
                            content: n,
                        });
                    }

                    // Ensure that we don't traverse the new node
                    assert.notEqual(n.id, 99);
                });

                // Traverse what remains and see if we get what is expected
                assert.deepEqual(
                    getTraversalOrder(copy),
                    expectedTraversals[id]
                );
            }
        });

        it("Can replace nodes with an array of nodes " + treenum, () => {
            const expectedTraversals = [
                null,
                [99, 101, 100, 3, 2, 5, 6, 7, 4, 0],
                [1, 99, 101, 100, 5, 6, 7, 4, 0],
                [1, 99, 101, 100, 2, 5, 6, 7, 4, 0],
                [1, 3, 2, 99, 101, 100, 0],
                [1, 3, 2, 99, 101, 100, 6, 7, 4, 0],
                [1, 3, 2, 5, 99, 101, 100, 7, 4, 0],
                [1, 3, 2, 5, 6, 99, 101, 100, 4, 0],
            ];

            // Loop through all the nodes except the root
            for (let id = 1; id < nodes.length; id++) {
                // Make a copy of the tree
                const copy = clone(tree);
                // Replace the node with two new ones
                new TreeTransformer(copy).traverse((n, state) => {
                    if (n.id === id) {
                        state.replace([
                            {
                                id: 99,
                                type: "replacement",
                            },
                            {
                                id: 100,
                                type: "replacement",
                                content: {
                                    id: 101,
                                    type: "nested",
                                },
                            },
                        ]);
                    }

                    // Ensure that we don't traverse any new nodes
                    assert.notEqual(n.id, 99);
                    assert.notEqual(n.id, 100);
                    assert.notEqual(n.id, 101);
                });

                // Traverse what remains and see if we get what is expected
                assert.deepEqual(
                    getTraversalOrder(copy),
                    expectedTraversals[id]
                );
            }
        });
    });
});
