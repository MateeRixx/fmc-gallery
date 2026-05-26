const fs = require('fs');
let code = fs.readFileSync('src/app/api/admin/photos/route.ts', 'utf8');

code = code.replace("    revalidatePath(`/events`, \"layout\");\r\n  }\r\n}", "    revalidatePath(`/events`, \"layout\");\n\n    return Response.json({\n      ok: true,\n      deleted_photo: deletedPhoto,\n      message: \"Photo and related face data deleted successfully\"\n    });\n  } catch (error) {\n    console.error(\"Delete photo failed:\", error);\n    return Response.json({\n      error: error instanceof Error ? error.message : \"Delete failed\"\n    }, { status: 500 });\n  }\n}");

code = code.replace("    revalidatePath(`/events`, \"layout\");\n  }\n}", "    revalidatePath(`/events`, \"layout\");\n\n    return Response.json({\n      ok: true,\n      deleted_photo: deletedPhoto,\n      message: \"Photo and related face data deleted successfully\"\n    });\n  } catch (error) {\n    console.error(\"Delete photo failed:\", error);\n    return Response.json({\n      error: error instanceof Error ? error.message : \"Delete failed\"\n    }, { status: 500 });\n  }\n}");

fs.writeFileSync('src/app/api/admin/photos/route.ts', code);
