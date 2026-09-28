"use client";

import {
  useState,
  type ReactNode,
} from "react";

import {
  resolveAssetUrl,
} from "@/lib/api";

import {
  ARTERY_COLOR,
  ARTERY_NAME,
} from "@/lib/arteries";

import type {
  AnalysisResult,
  ArteryName,
} from "@/lib/types";


type View =
  | "overlay"
  | "focus"
  | "isolated"
  | "mask"
  | "diameter";


const VIEWS: {
  id: View;
  label: string;
}[] = [
  {
    id: "overlay",
    label: "Overlay",
  },
  {
    id: "focus",
    label: "Focus",
  },
  {
    id: "isolated",
    label: "Isolated",
  },
  {
    id: "mask",
    label: "Mask",
  },
  {
    id: "diameter",
    label: "Diameter",
  },
];


export function ResultsView({
  result,
  onReset,
  resetLabel = "Analyse another image",
  actions,
}: {
  result: AnalysisResult;

  onReset: () => void;

  resetLabel?: string;

  actions?: ReactNode;
}) {

  const [
    selectedArtery,
    setSelectedArtery,
  ] = useState<
    ArteryName | null
  >(
    result
      .arteries_detected[0]
    ?? null
  );

  const [
    view,
    setView,
  ] = useState<View>(
    "overlay"
  );


  const artery =
    selectedArtery
      ? result.arteries[
          selectedArtery
        ]
      : null;


  const imageForView: Record<
    View,
    string | null | undefined
  > = {

    overlay:
      result.overlay_url,

    focus:
      artery?.focus_url,

    isolated:
      artery?.isolated_url,

    mask:
      artery?.mask_url,

    diameter:
      artery
        ?.diameter_overlay_url,
  };


  const displayImage =
    resolveAssetUrl(
      imageForView[
        view
      ]
    );


  const chooseArtery = (
    arteryName:
      ArteryName
  ) => {

    setSelectedArtery(
      arteryName
    );

    if (
      view
        === "overlay"
      &&
      result
        .arteries[
          arteryName
        ]
        ?.focus_url
    ) {

      setView(
        "focus"
      );
    }
  };


  const confidence =
    result
      .coronary_view
      .confidence;


  const ratio =
    result.image?.height
      ? (
          result.image.width
          /
          result.image.height
        )
      : 1;


  const panelWidth =
    `min(100%, ${
      (
        46
        * ratio
      ).toFixed(1)
    }svh)`;


  return (
    <div
      className="
        rise
        mx-auto
        w-full
        max-w-6xl
        px-5
        py-4
        md:px-8
        md:py-6
      "
    >

      {/* HEADER */}

      <div
        className="
          flex
          flex-wrap
          items-end
          justify-between
          gap-4
          border-b
          border-line
          pb-4
        "
      >

        <div>

          <p
            className="
              label
              mb-1
            "
          >
            Detected coronary system
          </p>

          <h2
            className="
              font-serif
              text-5xl
              leading-none
              md:text-6xl
            "
          >
            {
              result
                .coronary_view
                .label
            }
          </h2>

        </div>


        <div
          className="
            min-w-[14rem]
          "
        >

          <div
            className="
              flex
              items-baseline
              justify-between
            "
          >

            <span
              className="label"
            >
              Confidence
            </span>

            <span
              className="
                font-mono
                text-xl
              "
            >
              {
                `${
                  (
                    confidence
                    * 100
                  ).toFixed(
                    2
                  )
                }%`
              }
            </span>

          </div>


          <div
            className="
              mt-1.5
              h-px
              w-full
              bg-line
            "
          >

            <div
              className="
                h-px
                bg-accent
              "
              style={{
                width:
                  `${
                    confidence
                    * 100
                  }%`,
              }}
            />

          </div>


          <p
            className="
              label
              mt-2
              normal-case
              tracking-normal
            "
          >
            model{" "}
            {
              result
                .model_version
            }
            {" · "}
            id{" "}
            {
              result
                .analysis_id
                .slice(
                  0,
                  8
                )
            }
          </p>

        </div>

      </div>


      {/* IMAGES */}

      <div
        className="
          mt-4
          grid
          gap-4
          md:grid-cols-2
        "
      >

        <figure
          className="
            mx-auto
            w-full
          "
          style={{
            maxWidth:
              panelWidth,
          }}
        >

          <figcaption
            className="
              label
              mb-1.5
            "
          >
            Original
          </figcaption>

          <div
            className="
              border
              border-line
              bg-black
            "
          >

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                resolveAssetUrl(
                  result
                    .original_url
                )
              }
              alt="Original angiogram"
              className="
                block
                h-auto
                w-full
              "
            />

          </div>

        </figure>


        <figure
          className="
            mx-auto
            w-full
          "
          style={{
            maxWidth:
              panelWidth,
          }}
        >

          <figcaption
            className="
              label
              mb-1.5
            "
          >
            {
              view
                === "diameter"
                ? "Diameter profile"
                : "AI segmentation"
            }
          </figcaption>

          <div
            className="
              relative
              border
              border-line
              bg-black
            "
          >

            {
              displayImage
                ? (

                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      displayImage
                    }
                    alt={
                      view
                        === "diameter"
                        ? "Artery diameter profile"
                        : "Coronary analysis"
                    }
                    className="
                      block
                      h-auto
                      w-full
                    "
                  />

                )
                : (

                  <div
                    className="
                      flex
                      aspect-square
                      items-center
                      justify-center
                      p-6
                      text-center
                      text-sm
                      text-muted
                    "
                  >
                    This view is not available for the selected artery.
                  </div>

                )
            }

          </div>

        </figure>

      </div>


      {/* CONTROLS */}

      <div
        className="
          mt-4
          grid
          gap-4
          border-t
          border-line
          pt-4
          md:grid-cols-[auto_1fr]
          md:items-start
        "
      >

        <div>

          <p
            className="
              label
              mb-1.5
            "
          >
            View
          </p>

          <div
            className="
              inline-flex
              border
              border-line
            "
            role="group"
            aria-label="Analysis view"
          >

            {
              VIEWS.map(
                ({
                  id,
                  label,
                }) => {

                  const unavailable =
                    !imageForView[
                      id
                    ];

                  return (

                    <button
                      key={
                        id
                      }
                      aria-pressed={
                        view
                          === id
                      }
                      disabled={
                        unavailable
                      }
                      onClick={
                        () =>
                          setView(
                            id
                          )
                      }
                      className={`
                        px-3
                        py-1.5
                        text-sm
                        transition-colors
                        disabled:cursor-not-allowed
                        disabled:opacity-40
                        ${
                          view
                            === id

                            ? "bg-text text-bg"

                            : "text-muted hover:text-text"
                        }
                      `}
                    >
                      {
                        label
                      }
                    </button>

                  );
                }
              )
            }

          </div>

        </div>


        <div>

          <p
            className="
              label
              mb-1.5
            "
          >
            Arteries
          </p>

          <div
            className="
              flex
              flex-wrap
              gap-2
            "
          >

            {
              result
                .arteries_detected
                .map(
                  (
                    arteryName
                  ) => {

                    const selected =
                      selectedArtery
                        === arteryName;

                    return (

                      <button
                        key={
                          arteryName
                        }
                        aria-pressed={
                          selected
                        }
                        onClick={
                          () =>
                            chooseArtery(
                              arteryName
                            )
                        }
                        className="
                          flex
                          items-center
                          gap-2.5
                          border
                          px-3
                          py-1.5
                          text-sm
                          transition-colors
                        "
                        style={{
                          borderColor:
                            selected
                              ? ARTERY_COLOR[
                                  arteryName
                                ]
                              : "var(--line)",

                          background:
                            selected
                              ? `color-mix(in srgb, ${
                                  ARTERY_COLOR[
                                    arteryName
                                  ]
                                } 12%, transparent)`
                              : "transparent",
                        }}
                        title={
                          ARTERY_NAME[
                            arteryName
                          ]
                        }
                      >

                        <span
                          className="
                            h-2.5
                            w-2.5
                            rounded-full
                          "
                          style={{
                            background:
                              selected
                                ? ARTERY_COLOR[
                                    arteryName
                                  ]
                                : "transparent",

                            border:
                              `1.5px solid ${
                                ARTERY_COLOR[
                                  arteryName
                                ]
                              }`,
                          }}
                        />

                        <span
                          className="
                            font-mono
                            text-[0.8rem]
                            tracking-wider
                          "
                        >
                          {
                            arteryName
                          }
                        </span>

                      </button>

                    );
                  }
                )
            }

          </div>


          <p
            className="
              mt-2
              text-[0.75rem]
              leading-snug
              text-muted
            "
          >
            {
              result
                .arteries_detected
                .map(
                  (
                    arteryName
                  ) =>
                    `${
                      arteryName
                    }: ${
                      ARTERY_NAME[
                        arteryName
                      ]
                    }`
                )
                .join(
                  "  ·  "
                )
            }
          </p>

        </div>

      </div>


      {/* DIAMETER METRICS */}

      {
        view
          === "diameter"
        &&
        artery
          ?.diameter
        && (

          <div
            className="
              mt-4
              border-t
              border-line
              pt-4
            "
          >

            <p
              className="
                label
                mb-3
              "
            >
              Relative diameter profile
            </p>


            <div
              className="
                grid
                grid-cols-2
                gap-4
                md:grid-cols-4
              "
            >

              <DiameterMetric
                label="Median width"
                value={
                  `${
                    artery
                      .diameter
                      .median_px
                  } px`
                }
              />

              <DiameterMetric
                label="Mean width"
                value={
                  `${
                    artery
                      .diameter
                      .mean_px
                  } px`
                }
              />

              <DiameterMetric
                label="P20–P95 width"
                value={
                  `${
                    artery
                      .diameter
                      .p20_px
                  }–${
                    artery
                      .diameter
                      .p95_px
                  } px`
                }
              />

              <DiameterMetric
                label="Width variation"
                value={
                  `${
                    artery
                      .diameter
                      .relative_width_variation_pct
                  }%`
                }
              />

            </div>


            <p
              className="
                mt-3
                max-w-3xl
                text-[0.72rem]
                leading-relaxed
                text-muted
              "
            >
              Pixel-based relative vessel measurements.
              Physical millimeter diameter requires calibrated image spacing or DICOM metadata.
              Width variation is not a stenosis diagnosis.
            </p>

          </div>

        )
      }


      {/* FOOTER */}

      <div
        className="
          mt-4
          flex
          flex-wrap
          items-center
          justify-between
          gap-3
          border-t
          border-line
          pt-4
        "
      >

        <p
          className="
            max-w-lg
            text-[0.75rem]
            leading-snug
            text-muted
          "
        >
          Research prototype. This is not a diagnosis.
          Results must be reviewed by a qualified clinician.
        </p>


        <div
          className="
            flex
            flex-wrap
            items-center
            gap-3
          "
        >

          {
            actions
          }

          <button
            onClick={
              onReset
            }
            className="
              border
              border-accent
              px-5
              py-2
              text-sm
              text-accent
              transition-colors
              hover:bg-accent
              hover:text-bg
            "
          >
            {
              resetLabel
            }
          </button>

        </div>

      </div>

    </div>
  );
}


function DiameterMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {

  return (
    <div
      className="
        border
        border-line
        p-3
      "
    >

      <p
        className="
          label
          mb-1
        "
      >
        {
          label
        }
      </p>

      <p
        className="
          font-mono
          text-lg
          text-text
        "
      >
        {
          value
        }
      </p>

    </div>
  );
}