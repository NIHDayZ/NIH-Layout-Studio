import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LayoutParser } from "../.geometry-engine-test-build/LayoutParser.js";
import { MeasureLayoutTree, ArrangeMeasuredGeometry } from "../.geometry-engine-test-build/SnapshotForTests.js";
const source=readFileSync(new URL("./fixtures/workbench-grid/NIH_Grid_Variation_Matrix.layout",import.meta.url),"utf8");
const root=new LayoutParser().Parse(source).roots[0];
const prepared=MeasureLayoutTree([root]);
const samples={
  "VBaseline": {
    "rect": [
      20,
      20,
      71,
      51
    ],
    "children": [
      [
        24,
        24,
        40,
        10
      ],
      [
        67,
        24,
        20,
        15
      ],
      [
        24,
        42,
        30,
        25
      ]
    ]
  },
  "VPaddingZero": {
    "rect": [
      300,
      20,
      68,
      48
    ],
    "children": [
      [
        304,
        24,
        40,
        10
      ],
      [
        344,
        24,
        20,
        15
      ],
      [
        304,
        39,
        30,
        25
      ]
    ]
  },
  "VPaddingSeven": {
    "rect": [
      580,
      20,
      75,
      55
    ],
    "children": [
      [
        584,
        24,
        40,
        10
      ],
      [
        631,
        24,
        20,
        15
      ],
      [
        584,
        46,
        30,
        25
      ]
    ]
  },
  "VMarginZero": {
    "rect": [
      860,
      20,
      63,
      43
    ],
    "children": [
      [
        860,
        20,
        40,
        10
      ],
      [
        903,
        20,
        20,
        15
      ],
      [
        860,
        38,
        30,
        25
      ]
    ]
  },
  "VMarginSeven": {
    "rect": [
      20,
      270,
      77,
      57
    ],
    "children": [
      [
        27,
        277,
        40,
        10
      ],
      [
        70,
        277,
        20,
        15
      ],
      [
        27,
        295,
        30,
        25
      ]
    ]
  },
  "VOneChild": {
    "rect": [
      300,
      270,
      51,
      18
    ],
    "children": [
      [
        304,
        274,
        40,
        10
      ]
    ]
  },
  "VTwoChildren": {
    "rect": [
      580,
      270,
      71,
      23
    ],
    "children": [
      [
        584,
        274,
        40,
        10
      ],
      [
        627,
        274,
        20,
        15
      ]
    ]
  },
  "VFourChildren": {
    "rect": [
      860,
      270,
      71,
      51
    ],
    "children": [
      [
        864,
        274,
        40,
        10
      ],
      [
        907,
        274,
        20,
        15
      ],
      [
        864,
        292,
        30,
        25
      ],
      [
        907,
        292,
        12,
        18
      ]
    ]
  },
  "VThreeByTwo": {
    "rect": [
      20,
      520,
      104,
      33
    ],
    "children": [
      [
        24,
        524,
        40,
        10
      ],
      [
        67,
        524,
        20,
        15
      ],
      [
        90,
        524,
        30,
        25
      ]
    ]
  },
  "VTwoByThree": {
    "rect": [
      300,
      520,
      71,
      51
    ],
    "children": [
      [
        304,
        524,
        40,
        10
      ],
      [
        347,
        524,
        20,
        15
      ],
      [
        304,
        542,
        30,
        25
      ]
    ]
  },
  "VOneByFour": {
    "rect": [
      580,
      520,
      48,
      64
    ],
    "children": [
      [
        584,
        524,
        40,
        10
      ],
      [
        584,
        537,
        20,
        15
      ],
      [
        584,
        555,
        30,
        25
      ]
    ]
  }
};
const rect=r=>[r.x,r.y,r.width,r.height];
const nativeOptions={constrainedGrid:true,gridContentArrangement:true};
test("Phase 2I matches native parent and child rectangles for eleven independent variations",()=>{
	for(const viewport of [{x:0,y:0,width:1920,height:1080},{x:0,y:0,width:1120,height:720}]){
		const result=ArrangeMeasuredGeometry(prepared,viewport,1,nativeOptions);
		for(const node of root.children){
			const observed=samples[node.name];
			if(!observed) continue;
			assert.deepEqual(rect(result.byId.get(node.id).absoluteRect),observed.rect,node.name+" parent");
			assert.equal(node.children.length,observed.children.length);
			node.children.forEach((child,i)=>{
				assert.deepEqual(rect(result.byId.get(child.id).absoluteRect),observed.children[i],node.name+" child "+i);
			});
		}
		assert.equal(result.appliedStrategies.filter(s=>s.mode==="grid-content-prototype").length,11);
	}
});
test("Phase 2I keeps relative children unresolved and default snapshot unchanged",()=>{
	const viewport={x:0,y:0,width:1920,height:1080};
	const fallback=ArrangeMeasuredGeometry(prepared,viewport);
	const enabled=ArrangeMeasuredGeometry(prepared,viewport,1,nativeOptions);
	const relative=root.children.find(node=>node.name==="VRelativeChild");
	assert.deepEqual(rect(enabled.byId.get(relative.id).absoluteRect),rect(fallback.byId.get(relative.id).absoluteRect));
	assert.equal(enabled.appliedStrategies.some(s=>s.id===relative.id),false);
	assert.equal(fallback.appliedStrategies.length,0);
	assert.equal(fallback.gridNativeMeasurementPrototypes.size,0);
});
