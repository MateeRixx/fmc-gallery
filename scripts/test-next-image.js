const http = require('http');

const url1 = "http://localhost:3000/_next/image?url=https%3A%2F%2Futdtmmckfabhyiptbxow.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fprofile-photos%2Fvisitors%2F3e547aed-32a3-4e17-84a9-edb5c866f304_1775338470169.jpg&w=1080&q=75";
const url2 = "http://localhost:3000/_next/image?url=https%3A%2F%2Futdtmmckfabhyiptbxow.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fevent-images%2Furjotsav%2Fphotos%2F1773927113915-txamj0jc1s.jpg&w=1080&q=75";

http.get(url1, (res) => console.log('url1 status:', res.statusCode));
http.get(url2, (res) => console.log('url2 status:', res.statusCode));
