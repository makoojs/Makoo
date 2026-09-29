// ==UserScript==
// @name standalone-counter
// @version 1.0.0
// @match http://127.0.0.1/*
// @grant none
// ==/UserScript==

const button = document.createElement('button');
let count = 0;
button.textContent = `Count: ${count}`;
button.addEventListener('click', () => {
	button.textContent = `Count: ${++count}`;
});
document.body.append(button);
