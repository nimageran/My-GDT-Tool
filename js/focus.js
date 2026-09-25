// js/focus.js
// Hand-off between the search (or any link) and a tool: "open this tool and
// show this item". The caller sets the item before navigating; the tool takes
// it once in draw().

const pending = {};

export function setFocus(sym, value) {
    pending[sym] = value;
}

/** The item to show for this tool, if any. Cleared once taken. */
export function takeFocus(sym) {
    const v = pending[sym];
    delete pending[sym];
    return v;
}
