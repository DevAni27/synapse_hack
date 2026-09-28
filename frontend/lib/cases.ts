import {
  resolveAssetUrl,
} from "./api";

import {
  ARTERY_ORDER,
} from "./arteries";

import {
  BUCKET,
  supabase,
} from "./supabase";

import type {
  AnalysisResult,
  ArteryName as Artery,
  CoronaryView,
  DiameterResult,
} from "./types";


export interface ArteryPaths {
  mask?: string;

  isolated?: string;

  focus?: string;

  diameter_overlay?: string;

  diameter?: DiameterResult | null;
}


export interface CaseRow {
  id: string;

  user_id: string;

  backend_analysis_id:
    string | null;

  coronary_view:
    CoronaryView;

  confidence:
    number;

  arteries_detected:
    Artery[];

  model_version:
    string | null;

  image_width:
    number | null;

  image_height:
    number | null;

  original_path:
    string;

  overlay_path:
    string | null;

  mask_paths:
    Partial<
      Record<
        Artery,
        ArteryPaths | string
      >
    >;

  created_at:
    string;
}


function db() {

  if (!supabase) {

    throw new Error(
      "Supabase is not configured."
    );
  }

  return supabase;
}


async function fetchBlob(
  url: string,
  what: string,
): Promise<Blob> {

  let response: Response;

  try {

    response = await fetch(
      url
    );

  } catch {

    throw new Error(
      `Could not download the ${what} to save it. `
      + "The backend must allow CORS for this site."
    );
  }

  if (!response.ok) {

    throw new Error(
      `The ${what} is no longer available on the server `
      + `(${response.status}).`
    );
  }

  return response.blob();
}


export async function saveCase(
  result: AnalysisResult,
  original: File,
): Promise<string> {

  const client = db();

  const {
    data: auth,
  } = await client
    .auth
    .getUser();


  const uid =
    auth.user?.id;


  if (!uid) {

    throw new Error(
      "Please sign in first."
    );
  }


  const id =
    crypto.randomUUID();


  const base =
    `${uid}/${id}`;


  const uploaded:
    string[] = [];


  const put = async (
    path: string,
    blob: Blob,
  ) => {

    const {
      error,
    } = await client
      .storage
      .from(
        BUCKET
      )
      .upload(
        path,
        blob,
        {
          contentType:
            blob.type
            || "image/png",

          upsert:
            false,
        }
      );


    if (error) {

      throw new Error(
        `Upload failed: ${
          error.message
        }`
      );
    }


    uploaded.push(
      path
    );
  };


  try {

    const extension =
      original.type
        === "image/jpeg"
        ? "jpg"
        : "png";


    const originalPath =
      `${base}/original.${extension}`;


    await put(
      originalPath,
      original,
    );


    const overlayPath =
      `${base}/overlay.png`;


    await put(
      overlayPath,

      await fetchBlob(
        resolveAssetUrl(
          result.overlay_url
        ),
        "overlay",
      ),
    );


    const maskPaths:
      Partial<
        Record<
          Artery,
          ArteryPaths
        >
      > = {};


    for (
      const arteryName
      of ARTERY_ORDER
    ) {

      const artery =
        result
          .arteries?.[
            arteryName
          ];


      if (
        !artery
          ?.present
      ) {
        continue;
      }


      const entry:
        ArteryPaths = {};


      const images = [

        [
          "mask",
          artery.mask_url,
        ],

        [
          "isolated",
          artery.isolated_url,
        ],

        [
          "focus",
          artery.focus_url,
        ],

        [
          "diameter_overlay",
          artery
            .diameter_overlay_url,
        ],

      ] as const;


      for (
        const [
          kind,
          imageUrl,
        ]
        of images
      ) {

        if (!imageUrl) {
          continue;
        }


        const filename =
          kind
            === "diameter_overlay"

            ? (
                `${base}/`
                + `${arteryName.toLowerCase()}`
                + "_diameter.png"
              )

            : (
                `${base}/`
                + `${arteryName.toLowerCase()}`
                + `_${kind}.png`
              );


        await put(
          filename,

          await fetchBlob(
            resolveAssetUrl(
              imageUrl
            ),
            `${arteryName} ${kind} image`,
          ),
        );


        entry[
          kind
        ] = filename;
      }


      entry.diameter =
        artery.diameter;


      maskPaths[
        arteryName
      ] = entry;
    }


    const {
      error,
    } = await client
      .from(
        "analyses"
      )
      .insert({
        id,

        backend_analysis_id:
          result.analysis_id,

        coronary_view:
          result
            .coronary_view
            .label,

        confidence:
          result
            .coronary_view
            .confidence,

        arteries_detected:
          result
            .arteries_detected,

        model_version:
          result
            .model_version,

        image_width:
          result.image
            ?.width
          ?? null,

        image_height:
          result.image
            ?.height
          ?? null,

        original_path:
          originalPath,

        overlay_path:
          overlayPath,

        mask_paths:
          maskPaths,
      });


    if (error) {

      throw new Error(
        `Could not save the record: ${
          error.message
        }`
      );
    }


    return id;

  } catch (
    error
  ) {

    if (
      uploaded.length
    ) {

      await client
        .storage
        .from(
          BUCKET
        )
        .remove(
          uploaded
        );
    }


    throw error;
  }
}


export async function listCases():
Promise<CaseRow[]> {

  const {
    data,
    error,
  } = await db()
    .from(
      "analyses"
    )
    .select("*")
    .order(
      "created_at",
      {
        ascending:
          false,
      }
    );


  if (error) {

    throw new Error(
      error.message
    );
  }


  return (
    data
    ?? []
  ) as CaseRow[];
}


export async function signPaths(
  paths: string[],
): Promise<
  Record<
    string,
    string
  >
> {

  if (!paths.length) {
    return {};
  }


  const {
    data,
    error,
  } = await db()
    .storage
    .from(
      BUCKET
    )
    .createSignedUrls(
      paths,
      3600,
    );


  if (error) {

    throw new Error(
      error.message
    );
  }


  const output:
    Record<
      string,
      string
    > = {};


  for (
    const item
    of data
    ?? []
  ) {

    if (
      item.path
      &&
      item.signedUrl
    ) {

      output[
        item.path
      ] = item.signedUrl;
    }
  }


  return output;
}


function pathsOf(
  row: CaseRow,
): string[] {

  const paths: (
    string
    | null
    | undefined
  )[] = [

    row.original_path,

    row.overlay_path,
  ];


  for (
    const value
    of Object.values(
      row.mask_paths
      ?? {}
    )
  ) {

    if (
      typeof value
      === "string"
    ) {

      paths.push(
        value
      );

    } else if (
      value
    ) {

      paths.push(
        value.mask,

        value.isolated,

        value.focus,

        value
          .diameter_overlay,
      );
    }
  }


  return paths.filter(
    Boolean
  ) as string[];
}


export async function deleteCase(
  row: CaseRow,
): Promise<void> {

  const client =
    db();


  const files =
    pathsOf(
      row
    );


  const {
    error,
  } = await client
    .from(
      "analyses"
    )
    .delete()
    .eq(
      "id",
      row.id
    );


  if (error) {

    throw new Error(
      error.message
    );
  }


  if (
    files.length
  ) {

    await client
      .storage
      .from(
        BUCKET
      )
      .remove(
        files
      );
  }
}


export async function resultFromCase(
  row: CaseRow,
): Promise<AnalysisResult> {

  const signed =
    await signPaths(
      pathsOf(
        row
      )
    );


  const url = (
    path?: string | null
  ) => {

    if (!path) {
      return null;
    }

    return (
      signed[path]
      ?? null
    );
  };


  const arteries =
    {} as AnalysisResult[
      "arteries"
    ];


  for (
    const arteryName
    of ARTERY_ORDER
  ) {

    const raw =
      row.mask_paths?.[
        arteryName
      ];


    const paths:
      ArteryPaths =

      typeof raw
        === "string"

        ? {
            mask: raw,
          }

        : (
            raw
            ?? {}
          );


    arteries[
      arteryName
    ] = {

      present:
        row
          .arteries_detected
          .includes(
            arteryName
          ),

      mask_url:
        url(
          paths.mask
        ),

      isolated_url:
        url(
          paths.isolated
        ),

      focus_url:
        url(
          paths.focus
        ),

      diameter_overlay_url:
        url(
          paths
            .diameter_overlay
        ),

      diameter:
        paths.diameter
        ?? null,
    };
  }


  return {

    analysis_id:
      row
        .backend_analysis_id
      ?? row.id,

    coronary_view: {
      label:
        row
          .coronary_view,

      confidence:
        row
          .confidence,
    },

    arteries,

    arteries_detected:
      row
        .arteries_detected,

    original_url:
      url(
        row.original_path
      )
      ?? "",

    overlay_url:
      url(
        row.overlay_path
      )
      ?? "",

    review_required:
      false,

    model_version:
      row
        .model_version
      ?? "unknown",

    processing_time_ms:
      0,

    image: {
      width:
        row
          .image_width
        ?? 1,

      height:
        row
          .image_height
        ?? 1,
    },
  };
}


/* ---- care links ---- */


export interface LinkedPerson {
  id: string;

  full_name:
    string | null;
}


export async function linkPatient(
  code: string,
): Promise<void> {

  const {
    error,
  } = await db()
    .rpc(
      "link_patient",
      {
        code,
      }
    );


  if (error) {

    throw new Error(
      error.message
    );
  }
}


export async function listLinked(
  role:
    "patient"
    | "doctor",

  myId:
    string,
): Promise<
  LinkedPerson[]
> {

  const client =
    db();


  const {
    data: links,
    error,
  } = await client
    .from(
      "care_links"
    )
    .select(
      "doctor_id, patient_id"
    );


  if (error) {

    throw new Error(
      error.message
    );
  }


  const ids = (
    links
    ?? []
  )
    .map(
      (
        link
      ) =>
        role
          === "doctor"

          ? link.patient_id

          : link.doctor_id
    )
    .filter(
      (
        id
      ) =>
        id
        !== myId
    );


  if (!ids.length) {
    return [];
  }


  const {
    data,
  } = await client
    .from(
      "profiles"
    )
    .select(
      "id, full_name"
    )
    .in(
      "id",
      ids
    );


  return (
    data
    ?? []
  ) as LinkedPerson[];
}


export async function unlink(
  role:
    "patient"
    | "doctor",

  myId:
    string,

  otherId:
    string,
): Promise<void> {

  const query =
    db()
      .from(
        "care_links"
      )
      .delete();


  const {
    error,
  } = await (

    role
      === "doctor"

      ? query
          .eq(
            "doctor_id",
            myId
          )
          .eq(
            "patient_id",
            otherId
          )

      : query
          .eq(
            "patient_id",
            myId
          )
          .eq(
            "doctor_id",
            otherId
          )
  );


  if (error) {

    throw new Error(
      error.message
    );
  }
}


export async function namesFor(
  ids: string[],
): Promise<
  Record<
    string,
    string
  >
> {

  if (!ids.length) {
    return {};
  }


  const {
    data,
  } = await db()
    .from(
      "profiles"
    )
    .select(
      "id, full_name"
    )
    .in(
      "id",
      ids
    );


  const output:
    Record<
      string,
      string
    > = {};


  for (
    const profile
    of data
    ?? []
  ) {

    output[
      profile.id
    ] =
      profile
        .full_name
      || "Unnamed";
  }


  return output;
}