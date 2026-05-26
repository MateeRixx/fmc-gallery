const http = require('http');
fetch("http://localhost:3000/api/admin/photos", { method: 'DELETE', headers: { 'Content-type': 'application/json'} }).catch(e=>console.log(e));
