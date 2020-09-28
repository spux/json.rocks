import 'https://unpkg.com/dataisland?module'
import { h, html, render } from 'https://unpkg.com/spux?module'

var id = 'data'
var desc = JSON.stringify(di[id], null, 2)

render(
  html`
    <pre>
        ${desc}
    </pre
    >
    <hr />
    ${di[id].links.map(i => {
      return html`
        <a href="${i.link}">-></a> | <a href="${i.href}">${i.text}</a> <br />
      `
    })}
  `,
  document.body
)

