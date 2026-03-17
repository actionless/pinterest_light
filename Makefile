.PHONY: all clean build lint

NODE_MODULES := node_modules

all: lint build

build:
	./build.sh

lint: $(NODE_MODULES)
	./$(NODE_MODULES)/eslint/bin/eslint.js .

node_modules:
	npm install

clean:
	$(RM) -r $(NODE_MODULES)
	$(RM) pinterest_light.xpi
