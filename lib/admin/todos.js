import crypto from "crypto";
import { getDb } from "@/lib/mongo";

// Eigene Notizen auf der Startseite. Bewusst schlicht: Text, Hinweis,
// erledigt. Alles, was sich aus den Daten ableiten lässt (fehlendes
// Tagebuch, überfällige Rechnung), steht nicht hier, sondern entsteht in
// lib/admin/cockpit.js und verschwindet von selbst wieder.

async function col() {
  return (await getDb()).collection("admin_todos");
}

export async function listeTodos() {
  return (await col()).find({}).sort({ erledigt: 1, erstelltAm: -1 }).limit(50).toArray();
}

export async function legeTodoAn({ text, hinweis = "" }) {
  const todo = {
    _id: crypto.randomUUID(),
    text: String(text || "").trim().slice(0, 160),
    hinweis: String(hinweis || "").trim().slice(0, 160),
    erledigt: false,
    erledigtAm: null,
    erstelltAm: new Date().toISOString(),
  };
  await (await col()).insertOne(todo);
  return todo;
}

export async function setzeErledigt(id, erledigt) {
  return (await col()).findOneAndUpdate(
    { _id: id },
    { $set: { erledigt: Boolean(erledigt), erledigtAm: erledigt ? new Date().toISOString() : null } },
    { returnDocument: "after" }
  );
}

export async function loescheTodo(id) {
  const { deletedCount } = await (await col()).deleteOne({ _id: id });
  return deletedCount > 0;
}
