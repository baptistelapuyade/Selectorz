"""Optional: Beat-This!-Checkpoint selbst nach ONNX exportieren.

Nur nötig, wenn `npm run models` ein Modell nicht laden kann oder wir den
offiziellen Checkpoint der JKU Linz selbst konvertieren wollen.

    python -m venv .venv && . .venv/bin/activate
    pip install "beat-this==1.1.0" torch onnx onnxruntime
    python scripts/export_onnx.py --checkpoint small0
    python scripts/export_onnx.py --checkpoint final0

Ergebnis: public/models/beat-this-<checkpoint>.onnx
Eingang `spect` [Batch, Frames, 128] (Log-Mel, 50 fps), Ausgänge `beat`, `downbeat` (Logits).
Code und Gewichte von Beat This! stehen unter MIT-Lizenz.
"""
import argparse
import hashlib
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from beat_this.inference import load_model


class Wrapper(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, spect):
        out = self.model(spect)
        return out["beat"], out["downbeat"]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--checkpoint", default="small0", help="small0, final0, …")
    p.add_argument("--out", type=Path, default=Path(__file__).resolve().parent.parent / "public" / "models")
    args = p.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    target = args.out / f"beat-this-{args.checkpoint}.onnx"

    model = Wrapper(load_model(args.checkpoint, "cpu")).eval()
    dummy = torch.randn(1, 1500, 128)
    with torch.inference_mode():
        ref_beat, ref_down = model(dummy)
        torch.onnx.export(
            model, dummy, str(target), opset_version=17, dynamo=False,
            input_names=["spect"], output_names=["beat", "downbeat"],
            dynamic_axes={"spect": {0: "batch", 1: "frames"}, "beat": {0: "batch", 1: "frames"},
                          "downbeat": {0: "batch", 1: "frames"}},
        )
    sess = ort.InferenceSession(str(target))
    beat, down = sess.run(None, {"spect": dummy.numpy()})
    err = max(np.abs(beat - ref_beat.numpy()).max(), np.abs(down - ref_down.numpy()).max())
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    print(f"{target.name}: {target.stat().st_size / 1e6:.1f} MB, max. Abweichung zu PyTorch {err:.2e}, sha256 {digest}")


if __name__ == "__main__":
    main()
