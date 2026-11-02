import {
  type UnsubscribeCandidate,
  type UnsubscribeMechanism,
} from "../privacyTypes";

export interface RawUnsubscribeHeaderInput {
  domain: string;
  senderName: string;
  senderEmail: string;
  listUnsubscribeHeader?: string;
  listUnsubscribePostHeader?: string;
  emailCount?: number;
}

export class UnsubscribeDetector {
  /**
   * Parses angle-bracketed URIs from RFC 2369 List-Unsubscribe header.
   * Example: "<https://news.example.com/unsub?id=abc>, <mailto:unsub@example.com?subject=unsub>"
   */
  static parseUris(headerValue?: string): string[] {
    if (!headerValue) return [];
    const matches = headerValue.match(/<([^>]+)>/g);
    if (!matches) {
      // In case commas or plain URLs are present without brackets
      return headerValue
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.startsWith("http://") || s.startsWith("https://") || s.startsWith("mailto:"));
    }
    return matches.map((m) => m.replace(/^<|>$/g, "").trim());
  }

  /**
   * Parses mailto URI components into address and subject.
   */
  static parseMailto(mailtoUri: string): { address: string; subject?: string } {
    try {
      const clean = mailtoUri.replace(/^mailto:/i, "");
      const [address, query] = clean.split("?");
      let subject: string | undefined;

      if (query) {
        const searchParams = new URLSearchParams(query);
        subject = searchParams.get("subject") ?? undefined;
      }

      return {
        address: decodeURIComponent(address || ""),
        subject,
      };
    } catch {
      return { address: mailtoUri.replace(/^mailto:/i, "") };
    }
  }

  /**
   * Evaluates headers to classify unsubscribe mechanism and target details.
   */
  static detectMechanism(
    listUnsubscribe?: string,
    listUnsubscribePost?: string
  ): {
    mechanism: UnsubscribeMechanism;
    targetUrl?: string;
    mailtoAddress?: string;
    mailSubject?: string;
  } {
    const uris = this.parseUris(listUnsubscribe);
    const httpsUri = uris.find((u) => u.toLowerCase().startsWith("https://"));
    const mailtoUri = uris.find((u) => u.toLowerCase().startsWith("mailto:"));

    const isRfc8058Post =
      Boolean(listUnsubscribePost) &&
      listUnsubscribePost!.toLowerCase().includes("list-unsubscribe=one-click") &&
      Boolean(httpsUri);

    if (isRfc8058Post && httpsUri) {
      return {
        mechanism: "RFC_8058_POST",
        targetUrl: httpsUri,
      };
    }

    if (httpsUri) {
      return {
        mechanism: "WEB_FORM",
        targetUrl: httpsUri,
      };
    }

    if (mailtoUri) {
      const { address, subject } = this.parseMailto(mailtoUri);
      return {
        mechanism: "MAILTO",
        mailtoAddress: address,
        mailSubject: subject ?? "Unsubscribe",
      };
    }

    return {
      mechanism: "NONE",
    };
  }

  /**
   * Creates a normalized UnsubscribeCandidate.
   */
  static createCandidate(
    input: RawUnsubscribeHeaderInput,
    idPrefix = "unsub"
  ): UnsubscribeCandidate {
    const { mechanism, targetUrl, mailtoAddress, mailSubject } =
      this.detectMechanism(input.listUnsubscribeHeader, input.listUnsubscribePostHeader);

    const emailCount = input.emailCount ?? 1;
    let frequencyRating: "DAILY" | "WEEKLY" | "OCCASIONAL" = "OCCASIONAL";
    if (emailCount >= 10) {
      frequencyRating = "DAILY";
    } else if (emailCount >= 3) {
      frequencyRating = "WEEKLY";
    }

    const cleanDomain = input.domain.toLowerCase().trim();
    const id = `${idPrefix}_${cleanDomain.replace(/[^a-z0-9]/g, "_")}`;

    return {
      id,
      domain: cleanDomain,
      senderName: input.senderName,
      senderEmail: input.senderEmail,
      listUnsubscribeHeader: input.listUnsubscribeHeader,
      listUnsubscribePostHeader: input.listUnsubscribePostHeader,
      mechanism,
      targetUrl,
      mailtoAddress,
      mailSubject,
      frequencyRating,
      emailCount,
      status: "PENDING",
    };
  }
}
