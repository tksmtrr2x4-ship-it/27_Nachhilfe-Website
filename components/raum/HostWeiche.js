"use client";

import { useEffect, useState } from "react";
import Raum from "@/components/raum/Raum";

// Vor einer kostenpflichtigen Online-Stunde steht für den Gast erst die
// Rechnungsadresse (children = MeetingPayGate). Jill als Host – erkennbar am
// Ticket im Anker bzw. in diesem Tab – geht direkt in den Raum.
export default function HostWeiche({ token, raum, children }) {
  const [host, setHost] = useState(null);
  useEffect(() => {
    let ist = false;
    try {
      ist = /host=/.test(window.location.hash) || Boolean(sessionStorage.getItem(`raum_host_${token}`));
    } catch {
      ist = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHost(ist);
  }, [token]);
  if (host === null) return null;
  return host ? <Raum token={token} {...raum} /> : children;
}
